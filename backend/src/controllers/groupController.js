// src/controllers/groupController.js
import { supabase } from '../services/supabaseClient.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import jwt from 'jsonwebtoken';

export const createGroup = async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const created_by = req.user.username;

    let password_hash = null;
    if (password) password_hash = await hashPassword(password);

    const { data, error } = await supabase
      .from('groups')
      .insert([{ name, password_hash, created_by }])
      .select();

    if (error) throw error;

    // Add creator as member
    await supabase.from('group_members').insert([{ group_id: data[0].id, username: created_by }]);

    res.status(201).json({ message: 'Group created', group: data[0] });
  } catch (err) {
    next(err);
  }
};

export const joinGroup = async (req, res, next) => {
  try {
    const { group_id, password } = req.body;
    const username = req.user.username;

    const { data: group, error: gErr } = await supabase
      .from('groups')
      .select('*')
      .eq('id', group_id)
      .maybeSingle();

    if (gErr) throw gErr;
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (group.password_hash) {
      if (!password) {
        return res.status(400).json({ error: 'Password required for this group' });
      }
      const isValid = await comparePassword(password, group.password_hash);
      if (!isValid) return res.status(403).json({ error: 'Invalid password' });
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', group_id)
      .eq('username', username)
      .maybeSingle();

    if (existingMember) {
      return res.status(400).json({ error: 'User already a member of this group' });
    }

    const { error } = await supabase.from('group_members').insert([{ group_id, username }]);

    if (error) throw error;

    res.status(200).json({
      message: 'Joined group successfully',
      group: { id: group.id, name: group.name },
    });
  } catch (err) {
    next(err);
  }
};

export const getUserGroups = async (req, res, next) => {
  try {
    const username = req.user.username;

    const { data, error } = await supabase
      .from('group_members')
      .select('group_id, groups(*), joined_at')
      .eq('username', username);

    if (error) throw error;

    // Format response
    const groups = data.map(item => {
      const { password_hash, ...groupInfo } = item.groups;
      return {
        ...groupInfo,
        joined_at: item.joined_at,
        has_password: !!password_hash
      };
    });

    res.json(groups);
  } catch (err) {
    next(err);
  }
};

export const getGroupById = async (req, res, next) => {
  try {
    const { group_id } = req.params;
    const username = req.user.username;

    // Check if user is a member
    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', group_id)
      .eq('username', username)
      .maybeSingle();

    // Get group info (even if not a member, so they can see it to join)
    const { data: group, error: gErr } = await supabase
      .from('groups')
      .select('*')
      .eq('id', group_id)
      .maybeSingle();

    if (gErr) throw gErr;
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Don't return password_hash in response
    const { password_hash, ...groupInfo } = group;

    res.json({
      ...groupInfo,
      is_member: !!membership,
      has_password: !!password_hash
    });
  } catch (err) {
    next(err);
  }
};

export const getGroupMembers = async (req, res, next) => {
  try {
    const { group_id } = req.params;
    const username = req.user.username;

    // Verify user is a member
    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const { data, error } = await supabase
      .from('group_members')
      .select('username, joined_at, users(username, email, full_name)')
      .eq('group_id', group_id);

    if (error) throw error;

    // Format response
    const members = data.map(item => ({
      username: item.username,
      joined_at: item.joined_at,
      ...item.users
    }));

    res.json(members);
  } catch (err) {
    next(err);
  }
};

// Helper function to check if a member has active settlements and get settlement details
const checkMemberHasSettlements = async (group_id, memberUsername) => {
  try {
    // Get all trips in the group
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('id')
      .eq('group_id', group_id);

    if (tripsError) throw tripsError;
    if (!trips || trips.length === 0) return { hasSettlements: false, details: null }; // No trips, no settlements

    const tripIds = trips.map(t => t.id);

    // Get all expenses for all trips in the group
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('*')
      .in('trip_id', tripIds);

    if (expError) throw expError;
    if (!expenses || expenses.length === 0) return { hasSettlements: false, details: null }; // No expenses, no settlements

    // Get all group members
    const { data: members, error: memError } = await supabase
      .from('group_members')
      .select('username')
      .eq('group_id', group_id);

    if (memError) throw memError;
    const memberUsernames = members.map(m => m.username);

    // Calculate balances: how much each person owes/paid
    const balances = {};
    memberUsernames.forEach(username => {
      balances[username] = { paid: 0, owes: 0, net: 0 };
    });

    // Process each expense
    expenses.forEach(expense => {
      const { payer_username, amount, participants } = expense;
      if (!participants || participants.length === 0) return;
      
      const sharePerPerson = parseFloat(amount) / participants.length;

      // Add to paid amount
      if (balances[payer_username]) {
        balances[payer_username].paid += parseFloat(amount);
      }

      // Add to owes amount for each participant
      participants.forEach(participant => {
        if (balances[participant]) {
          balances[participant].owes += sharePerPerson;
        }
      });
    });

    // Calculate net balance for all members
    Object.keys(balances).forEach(username => {
      balances[username].net = balances[username].paid - balances[username].owes;
    });

    // Check if member exists in balances
    if (!balances[memberUsername]) {
      return { hasSettlements: false, details: null };
    }

    const memberBalance = balances[memberUsername].net;

    // Check if member has non-zero balance (either owes or is owed money)
    // Using 0.01 as threshold to account for floating point precision
    const hasNonZeroBalance = Math.abs(memberBalance) > 0.01;

    if (!hasNonZeroBalance) {
      return { hasSettlements: false, details: null };
    }

    // Calculate actual settlements to see if member is involved in any transaction
    const settlements = [];
    const creditors = [];
    const debtors = [];

    // Separate creditors and debtors
    Object.keys(balances).forEach(username => {
      const net = balances[username].net;
      if (net > 0.01) {
        creditors.push({ username, amount: net });
      } else if (net < -0.01) {
        debtors.push({ username, amount: Math.abs(net) });
      }
    });

    // Sort by amount (largest first)
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    // Calculate optimal settlements
    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];

      const settleAmount = Math.min(creditor.amount, debtor.amount);

      if (settleAmount > 0.01) {
        settlements.push({
          from: debtor.username,
          to: creditor.username,
          amount: parseFloat(settleAmount.toFixed(2))
        });
      }

      creditor.amount -= settleAmount;
      debtor.amount -= settleAmount;

      if (creditor.amount < 0.01) creditorIndex++;
      if (debtor.amount < 0.01) debtorIndex++;
    }

    // Check if member is involved in any settlement transaction
    const memberInvolvedInSettlements = settlements.some(settlement => 
      settlement.from === memberUsername || settlement.to === memberUsername
    );

    // Get settlement details for the member
    const memberSettlements = settlements.filter(settlement => 
      settlement.from === memberUsername || settlement.to === memberUsername
    );

    // Build detailed message
    let details = null;
    if (memberInvolvedInSettlements) {
      const owesList = memberSettlements
        .filter(s => s.from === memberUsername)
        .map(s => `${s.to} ($${s.amount.toFixed(2)})`)
        .join(', ');
      
      const owedByList = memberSettlements
        .filter(s => s.to === memberUsername)
        .map(s => `${s.from} ($${s.amount.toFixed(2)})`)
        .join(', ');

      details = {
        balance: parseFloat(memberBalance.toFixed(2)),
        owes: owesList || null,
        owedBy: owedByList || null,
        settlementCount: memberSettlements.length
      };
    }

    return {
      hasSettlements: memberInvolvedInSettlements || hasNonZeroBalance,
      details
    };
  } catch (error) {
    // If there's an error checking settlements, be safe and prevent deletion
    console.error('Error checking settlements:', error);
    return { 
      hasSettlements: true, 
      details: { error: 'Unable to verify settlements' } 
    }; // Assume they have settlements to be safe
  }
};

// Creator-only: remove a member from the group
export const removeGroupMember = async (req, res, next) => {
  try {
    const { group_id } = req.params;
    const { username: memberToRemove } = req.body; // username to remove
    const requester = req.user.username;

    if (!memberToRemove) return res.status(400).json({ error: 'username is required' });

    // Fetch group and verify creator
    const { data: group, error: gErr } = await supabase
      .from('groups')
      .select('id, created_by')
      .eq('id', group_id)
      .maybeSingle();
    if (gErr) throw gErr;
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.created_by !== requester) {
      return res.status(403).json({ error: 'Only the group creator can remove members' });
    }

    // Creator cannot remove themselves through this endpoint (use deleteGroup or leave logic)
    if (memberToRemove === group.created_by) {
      return res.status(400).json({ error: 'Creator cannot be removed from the group' });
    }

    // Ensure target is a member
    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id, username')
      .eq('group_id', group_id)
      .eq('username', memberToRemove)
      .maybeSingle();
    if (!membership) return res.status(404).json({ error: 'User is not a member of the group' });

    // Check if member has active settlements (owes money or is owed money)
    const settlementCheck = await checkMemberHasSettlements(group_id, memberToRemove);
    if (settlementCheck.hasSettlements) {
      let errorMessage = 'Cannot remove member: This user has pending settlements. ';
      
      if (settlementCheck.details) {
        const { balance, owes, owedBy, settlementCount } = settlementCheck.details;
        
        if (balance !== undefined) {
          if (balance > 0) {
            errorMessage += `They are owed $${Math.abs(balance).toFixed(2)}. `;
          } else {
            errorMessage += `They owe $${Math.abs(balance).toFixed(2)}. `;
          }
        }
        
        if (owes) {
          errorMessage += `Pending payments: ${owes}. `;
        }
        
        if (owedBy) {
          errorMessage += `Pending receipts: ${owedBy}. `;
        }
        
        if (settlementCount > 0) {
          errorMessage += `They are involved in ${settlementCount} settlement transaction(s). `;
        }
      }
      
      errorMessage += 'Please settle all balances before removing this member.';
      
      return res.status(400).json({ 
        error: errorMessage,
        settlements: settlementCheck.details
      });
    }

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', group_id)
      .eq('username', memberToRemove);
    if (error) throw error;

    // Collect all trip ids in this group
    const { data: allTripsInGroup, error: allTripsErr } = await supabase
      .from('trips')
      .select('id, created_by')
      .eq('group_id', group_id);
    if (allTripsErr) throw allTripsErr;
    const allTripIds = (allTripsInGroup || []).map(t => t.id);

    // 1) ONLY delete trips CREATED by the removed member
    const createdTrips = (allTripsInGroup || []).filter(t => t.created_by === memberToRemove).map(t => t.id);
    if (createdTrips.length > 0) {
      const { error: delTripsErr } = await supabase.from('trips').delete().in('id', createdTrips);
      if (delTripsErr) throw delTripsErr;
    }

    // 2) For trips NOT created by this user (remaining trips), clean up their data
    const remainingTripIds = allTripIds.filter(id => !createdTrips.includes(id));
    if (remainingTripIds.length > 0) {
      // Remove from trip_members for all remaining trips
      const { error: delTripMembersErr } = await supabase
        .from('trip_members')
        .delete()
        .in('trip_id', remainingTripIds)
        .eq('username', memberToRemove);
      if (delTripMembersErr) throw delTripMembersErr;

      // Delete expenses where this user was the payer
      const { error: delUserExpensesErr } = await supabase
        .from('expenses')
        .delete()
        .in('trip_id', remainingTripIds)
        .eq('payer_username', memberToRemove);
      if (delUserExpensesErr) throw delUserExpensesErr;

      // Remove this user from participants arrays for remaining expenses
      const { data: expsWithUser, error: fetchExpErr } = await supabase
        .from('expenses')
        .select('id, participants')
        .in('trip_id', remainingTripIds)
        .contains('participants', [memberToRemove]);
      if (fetchExpErr) throw fetchExpErr;
      if (expsWithUser && expsWithUser.length > 0) {
        for (const exp of expsWithUser) {
          const newParticipants = (exp.participants || []).filter(u => u !== memberToRemove);
          const { error: updErr } = await supabase
            .from('expenses')
            .update({ participants: newParticipants })
            .eq('id', exp.id);
          if (updErr) throw updErr;
        }
      }
      // Delete places uploaded by this user in remaining trips (if created_by column exists)
      const { error: delPlacesErr } = await supabase
        .from('places_visited')
        .delete()
        .in('trip_id', remainingTripIds)
        .eq('created_by', memberToRemove);
      if (delPlacesErr && delPlacesErr.code !== '42703') {
        // ignore if column doesn't exist in older schemas
        throw delPlacesErr;
      }
    }

    res.json({ message: 'Member removed and related trips deleted (if any)' });
  } catch (err) {
    next(err);
  }
};

// Generate invite token for a group (members only)
export const generateInvite = async (req, res, next) => {
  try {
    const { group_id } = req.params;
    const username = req.user.username;

    // Verify requester is a member
    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'Only group members can create invite links' });
    }

    const payload = { group_id };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key-change-in-production', {
      expiresIn: '7d',
      subject: 'group_invite'
    });

    res.json({ token });
  } catch (err) {
    next(err);
  }
};

// Join a group using an invite token (requires authenticated user)
export const joinByInvite = async (req, res, next) => {
  try {
    const { token } = req.body;
    const username = req.user.username;

    if (!token) return res.status(400).json({ error: 'Invite token is required' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
      if (decoded.sub !== 'group_invite') {
        return res.status(400).json({ error: 'Invalid invite token' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid or expired invite token' });
    }

    const group_id = decoded.group_id;

    // Ensure group exists
    const { data: group, error: gErr } = await supabase
      .from('groups')
      .select('id, name')
      .eq('id', group_id)
      .maybeSingle();

    if (gErr) throw gErr;
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', group_id)
      .eq('username', username)
      .maybeSingle();

    if (existingMember) {
      return res.status(200).json({ message: 'Already a member', group });
    }

    const { error } = await supabase.from('group_members').insert([{ group_id, username }]);
    if (error) {
      // If concurrent requests hit, handle unique violation gracefully
      if (error.code === '23505') {
        return res.status(200).json({ message: 'Already a member', group });
      }
      throw error;
    }
    // const { error } = await supabase.from('group_members').insert([{ group_id, username }]);
    // if (error) {
    //   if (error.code === '23505') {
    //     return res.status(200).json({ message: 'Already a member', group: { id: group_id } });
    //   }
    //   throw error;
    // }

    res.status(200).json({ message: 'Joined group via invite', group });
  } catch (err) {
    next(err);
  }
};

export const deleteGroup = async (req, res, next) => {
  try {
    const { group_id } = req.params;
    const username = req.user.username;

    // Only group creator can delete
    const { data: group, error: gErr } = await supabase
      .from('groups')
      .select('id, created_by')
      .eq('id', group_id)
      .maybeSingle();

    if (gErr) throw gErr;
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.created_by !== username) {
      return res.status(403).json({ error: 'Only the group creator can delete the group' });
    }

    const { error } = await supabase.from('groups').delete().eq('id', group_id);
    if (error) throw error;

    res.json({ message: 'Group deleted' });
  } catch (err) {
    next(err);
  }
};

// Creator-only: set or clear group password
export const updateGroupPassword = async (req, res, next) => {
  try {
    const { group_id } = req.params;
    const { password } = req.body; // string | null | undefined
    const username = req.user.username;

    const { data: group, error: gErr } = await supabase
      .from('groups')
      .select('id, created_by')
      .eq('id', group_id)
      .maybeSingle();

    if (gErr) throw gErr;
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.created_by !== username) {
      return res.status(403).json({ error: 'Only the group creator can change the password' });
    }

    let password_hash = null;
    if (password && password.trim().length > 0) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      password_hash = await hashPassword(password);
    }

    const { error } = await supabase
      .from('groups')
      .update({ password_hash })
      .eq('id', group_id);

    if (error) throw error;
    res.json({ message: password_hash ? 'Password updated' : 'Password removed' });
  } catch (err) {
    next(err);
  }
};