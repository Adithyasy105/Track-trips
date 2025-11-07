// src/controllers/tripController.js
import { supabase } from '../services/supabaseClient.js';

export const createTrip = async (req, res, next) => {
  try {
    const { group_id, name, location, start_date, end_date, description, members } = req.body;
    const username = req.user.username;

    // Verify user is a member of the group
    const { data: membership, error: memError } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', group_id)
      .eq('username', username)
      .maybeSingle();

    if (memError) throw memError;
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const { data, error } = await supabase
      .from('trips')
      .insert([{ group_id, name, location, start_date, end_date, description, created_by: username }])
      .select();

    if (error) throw error;

    // Optional: add trip members if provided (must be group members)
    const trip = data[0];
    const uniqueMembers = Array.isArray(members) ? Array.from(new Set(members.filter(Boolean))) : [];
    if (uniqueMembers.length > 0) {
      // Verify provided members are part of the group
      const { data: groupMembers, error: gmErr } = await supabase
        .from('group_members')
        .select('username')
        .eq('group_id', group_id);
      if (gmErr) throw gmErr;
      const allowed = new Set((groupMembers || []).map(m => m.username));
      const toInsert = uniqueMembers.filter(u => allowed.has(u)).map(u => ({ trip_id: trip.id, username: u }));
      // Always include creator
      if (allowed.has(username) && !toInsert.find(r => r.username === username)) {
        toInsert.push({ trip_id: trip.id, username });
      }
      if (toInsert.length > 0) {
        const { error: tmErr } = await supabase.from('trip_members').insert(toInsert);
        if (tmErr && tmErr.code !== '23505') throw tmErr; // ignore duplicates
      }
    } else {
      // If none provided, include creator as default member
      const { error: tmErr } = await supabase.from('trip_members').insert([{ trip_id: trip.id, username }]);
      if (tmErr && tmErr.code !== '23505') throw tmErr;
    }

    res.status(201).json({ message: 'Trip created successfully', trip });
  } catch (err) {
    next(err);
  }
};

export const getGroupTrips = async (req, res, next) => {
  try {
    const { group_id } = req.params;
    const username = req.user.username;

    // Verify membership
    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Get trips where user is a member (via trip_members) or created the trip
    const { data: tripMemberships, error: tmErr } = await supabase
      .from('trip_members')
      .select('trip_id')
      .eq('username', username);
    if (tmErr) throw tmErr;
    const userTripIds = new Set((tripMemberships || []).map(tm => tm.trip_id));

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('group_id', group_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter: show trips where user is in trip_members OR created the trip
    const filtered = (data || []).filter(trip => 
      userTripIds.has(trip.id) || trip.created_by === username
    );
    res.json(filtered);
  } catch (err) {
    next(err);
  }
};

export const getTripById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const username = req.user.username;

    // Get trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*, groups(*)')
      .eq('id', id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', trip.group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Also include group_id directly for easier access
    const tripWithGroupId = {
      ...trip,
      group_id: trip.group_id
    };

    res.json(tripWithGroupId);
  } catch (err) {
    next(err);
  }
};

export const updateTrip = async (req, res, next) => {
  try {
    const { id } = req.params;
    const username = req.user.username;
    const updates = req.body;

    // Get trip and verify membership
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('group_id, created_by')
      .eq('id', id)
      .single();

    if (tripError) throw tripError;
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', trip.group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const { data, error } = await supabase
      .from('trips')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ message: 'Trip updated successfully', trip: data[0] });
  } catch (err) {
    next(err);
  }
};

// Helper to check if trip has unsettled balances (only trip members)
// ✅ FINAL VERSION — Strict balance check for Supabase ARRAY or JSON column
const checkTripMemberHasSettlements = async (trip_id, memberUsername) => {
  try {
    // 1️⃣ Get all expenses for the trip
    const { data: expenses, error: expErr } = await supabase
      .from('expenses')
      .select('payer_username, amount, participants')
      .eq('trip_id', trip_id);

    if (expErr) throw expErr;

    // No expenses = no settlements
    if (!expenses || expenses.length === 0) {
      return { hasSettlements: false, details: null };
    }

    // 2️⃣ Get trip members
    const { data: tripMembers, error: memErr } = await supabase
      .from('trip_members')
      .select('username')
      .eq('trip_id', trip_id);

    if (memErr) throw memErr;

    const memberList = tripMembers.map(m => m.username);
    const memberSet = new Set(memberList);
    memberSet.add(memberUsername); // Ensure member is included

    // 3️⃣ Initialize balances
    const balances = {};
    for (const user of memberSet) {
      balances[user] = { paid: 0, owes: 0, net: 0 };
    }

    // 4️⃣ Compute balances
    for (const exp of expenses) {
      const payer = exp.payer_username;
      const amount = parseFloat(exp.amount);
      let participants = exp.participants;

      // 🔧 FIX: handle both array and string
      if (typeof participants === 'string') {
        // Postgres may return `{adi,anu}` as a string
        participants = participants
          .replace(/[{}"]/g, '')
          .split(',')
          .map(x => x.trim())
          .filter(Boolean);
      }

      if (!Array.isArray(participants) || participants.length === 0) continue;

      const share = amount / participants.length;

      // Add paid amount
      if (balances[payer]) balances[payer].paid += amount;

      // Add owed share
      for (const p of participants) {
        if (balances[p]) balances[p].owes += share;
      }
    }

    // 5️⃣ Calculate net balances
    for (const user of Object.keys(balances)) {
      const paid = balances[user].paid || 0;
      const owes = balances[user].owes || 0;
      balances[user].net = parseFloat((paid - owes).toFixed(2));
    }

    // 6️⃣ Get member's balance
    const memberBalance = balances[memberUsername]?.net || 0;

    console.log(`[SETTLEMENT CHECK] ${memberUsername} → Paid: ${balances[memberUsername]?.paid}, Owes: ${balances[memberUsername]?.owes}, Net: ${memberBalance}`);

    // 7️⃣ Block deletion if balance not zero
    if (Math.abs(memberBalance) >= 0.01) {
      const details = {
        balance: memberBalance,
        status:
          memberBalance > 0
            ? `User is owed ₹${memberBalance.toFixed(2)}`
            : `User owes ₹${Math.abs(memberBalance).toFixed(2)}`
      };
      return { hasSettlements: true, details };
    }

    // ✅ Member fully settled
    return { hasSettlements: false, details: null };

  } catch (err) {
    console.error('🔥 Error checking member settlements:', err);
    return { hasSettlements: true, details: { error: 'Unable to verify settlements' } };
  }
};


export const getTripMembers = async (req, res, next) => {
  try {
    const { id } = req.params; // trip id
    const username = req.user.username;

    // Verify requester has access (is in the group's members)
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', id)
      .maybeSingle();
    if (tripErr) throw tripErr;
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', trip.group_id)
      .eq('username', username)
      .maybeSingle();
    if (!membership) return res.status(403).json({ error: 'You are not a member of this group' });

    const { data, error } = await supabase
      .from('trip_members')
      .select('username, users(username, full_name, email)')
      .eq('trip_id', id);
    if (error) throw error;

    const members = (data || []).map(m => ({
      username: m.username,
      full_name: m.users?.full_name,
      email: m.users?.email,
    }));
    res.json(members);
  } catch (err) {
    next(err);
  }
};

export const addTripMember = async (req, res, next) => {
  try {
    const { id } = req.params; // trip id
    const { username: memberToAdd } = req.body;
    const requester = req.user.username;
    if (!memberToAdd) return res.status(400).json({ error: 'username is required' });

    // Fetch trip details
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('group_id, created_by')
      .eq('id', id)
      .maybeSingle();
    if (tripErr) throw tripErr;
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Only trip creator can add
    if ((trip.created_by || '').trim().toLowerCase() !== (requester || '').trim().toLowerCase()) {
      return res.status(403).json({ error: 'Only the trip creator can add members' });
    }

    // Ensure target is a member of the group
    const { data: groupMember } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', trip.group_id)
      .eq('username', memberToAdd)
      .maybeSingle();
    if (!groupMember) return res.status(400).json({ error: 'User is not a member of the group' });

    // Insert into trip_members
    const { error } = await supabase
      .from('trip_members')
      .insert([{ trip_id: id, username: memberToAdd }]);
    if (error && error.code !== '23505') throw error; // ignore duplicate

    res.json({ message: 'Member added to trip' });
  } catch (err) {
    next(err);
  }
};



export const removeTripMember = async (req, res, next) => {
  try {
    const { id } = req.params; // trip id
    const { username: memberToRemove } = req.body;
    const requester = req.user.username;
    if (!memberToRemove) return res.status(400).json({ error: 'username is required' });

    // Fetch trip details
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('group_id, created_by')
      .eq('id', id)
      .maybeSingle();
    if (tripErr) throw tripErr;
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Only trip creator can remove members
    if ((trip.created_by || '').trim().toLowerCase() !== (requester || '').trim().toLowerCase()) {
      return res.status(403).json({ error: 'Only the trip creator can remove members' });
    }

    // Trip creator cannot remove themselves
    if (memberToRemove === trip.created_by) {
      return res.status(400).json({ error: 'Trip creator cannot be removed from the trip' });
    }

    // Ensure target is a trip member
    const { data: tripMember } = await supabase
      .from('trip_members')
      .select('*')
      .eq('trip_id', id)
      .eq('username', memberToRemove)
      .maybeSingle();
    if (!tripMember) return res.status(404).json({ error: 'User is not a member of this trip' });

    // Check if member has active settlements in this trip
    // This MUST block deletion if member has any non-zero balance
    console.log(`[DEBUG] Checking settlements for member ${memberToRemove} in trip ${id}`);
    const settlementCheck = await checkTripMemberHasSettlements(id, memberToRemove);
    
    console.log(`[DEBUG] Settlement check result:`, {
      hasSettlements: settlementCheck.hasSettlements,
      details: settlementCheck.details
    });
    
    if (settlementCheck.hasSettlements) {
      console.log(`[DEBUG] ⛔ BLOCKING removal of ${memberToRemove} due to settlements`);
      // Format error message to match frontend expectations
      let errorMessage = 'Cannot remove member: They have active settlements (money owed or owed to them). Please settle all balances before removing this member.';
      
      // Build detailed message with balance information
      let detailMessage = `@${memberToRemove} has active settlements:`;
      
      if (settlementCheck.details && settlementCheck.details.balance !== undefined) {
        const { balance } = settlementCheck.details;
        
        if (balance > 0) {
          detailMessage += ` They are owed ₹${Math.abs(balance).toFixed(2)}.`;
        } else if (balance < 0) {
          detailMessage += ` They owe ₹${Math.abs(balance).toFixed(2)}.`;
        }
      }
      
      return res.status(400).json({ 
        error: errorMessage,
        title: 'Cannot Remove Member',
        subtitle: 'Pending Settlements Detected',
        detail: detailMessage,
        note: 'Note: All balances must be settled to ₹0.00 before a member can be removed from the trip.',
        member: {
          username: memberToRemove
        },
        settlements: settlementCheck.details
      });
    }

    console.log(`[DEBUG] ✅ No settlements found for ${memberToRemove}, proceeding with removal`);

    // Remove from trip_members
    const { error } = await supabase
      .from('trip_members')
      .delete()
      .eq('trip_id', id)
      .eq('username', memberToRemove);
    if (error) throw error;

    // Cleanup within this trip after removal
    // 1) Delete expenses where this user was the payer
    const { error: delExpErr } = await supabase
      .from('expenses')
      .delete()
      .eq('trip_id', id)
      .eq('payer_username', memberToRemove);
    if (delExpErr) throw delExpErr;

    // 2) Remove user from participants arrays on remaining expenses
    const { data: expsWithUser, error: fetchExpsErr } = await supabase
      .from('expenses')
      .select('id, participants')
      .eq('trip_id', id)
      .contains('participants', [memberToRemove]);
    if (fetchExpsErr) throw fetchExpsErr;
    if (expsWithUser && expsWithUser.length > 0) {
      for (const exp of expsWithUser) {
        const updated = (exp.participants || []).filter(u => u !== memberToRemove);
        const { error: updErr } = await supabase
          .from('expenses')
          .update({ participants: updated })
          .eq('id', exp.id);
        if (updErr) throw updErr;
      }
    }

    // 3) Delete places uploaded by this user in this trip (if schema supports created_by)
    const { error: delPlacesErr } = await supabase
      .from('places_visited')
      .delete()
      .eq('trip_id', id)
      .eq('created_by', memberToRemove);
    if (delPlacesErr && delPlacesErr.code !== '42703') {
      // ignore if column doesn't exist in older schemas
      throw delPlacesErr;
    }

    res.json({ message: 'Member removed from trip and related data cleaned' });
  } catch (err) {
    next(err);
  }
};


// ✅ Helper: Check if entire trip has any unsettled balances before deleting
const checkTripHasUnsettledBalances = async (trip_id) => {
  try {
    const { data: members, error: memErr } = await supabase
      .from('trip_members')
      .select('username')
      .eq('trip_id', trip_id);
    if (memErr) throw memErr;

    if (!members || members.length === 0)
      return { hasUnsettled: false, details: [] };

    const unsettledDetails = [];

    for (const member of members) {
      const result = await checkTripMemberHasSettlements(trip_id, member.username);
      if (result.hasSettlements) {
        unsettledDetails.push({
          username: member.username,
          ...result.details
        });
      }
    }

    return {
      hasUnsettled: unsettledDetails.length > 0,
      details: unsettledDetails
    };
  } catch (error) {
    console.error('Error checking trip unsettled balances:', error);
    return {
      hasUnsettled: true,
      details: [{ error: 'Unable to verify trip settlements' }]
    };
  }
};



// ✅ Delete a trip safely (only creator, and only if all balances are settled)
export const deleteTrip = async (req, res, next) => {
  try {
    const { id } = req.params; // trip_id
    const username = req.user.username;

    // 1️⃣ Fetch trip details
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('group_id, created_by')
      .eq('id', id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // 2️⃣ Only trip creator can delete
    if ((trip.created_by || '').trim().toLowerCase() !== username.trim().toLowerCase()) {
      return res.status(403).json({ error: 'Only the trip creator can delete this trip' });
    }

    // 3️⃣ Check if any trip member has unsettled balances
    const settlementCheck = await checkTripHasUnsettledBalances(id);

    if (settlementCheck.hasUnsettled) {
      let msg = "Cannot delete trip: Some trip members still have unsettled balances. ";

      if (settlementCheck.details && settlementCheck.details.length > 0) {
        const detailMsg = settlementCheck.details
          .map(
            (d) =>
              `${d.username} ${d.balance > 0
                ? `is owed ₹${Math.abs(d.balance).toFixed(2)}`
                : `owes ₹${Math.abs(d.balance).toFixed(2)}`}`
          )
          .join('; ');
        msg += `Details: ${detailMsg}. `;
      }

      msg += "Please settle all balances before deleting this trip.";

      return res.status(400).json({
        error: msg,
        settlements: settlementCheck.details || [],
      });
    }

    // 4️⃣ Safe to delete all associated data
    await supabase.from('places_visited').delete().eq('trip_id', id);
    await supabase.from('expenses').delete().eq('trip_id', id);
    await supabase.from('trip_members').delete().eq('trip_id', id);

    // 5️⃣ Finally, delete the trip itself
    const { error: delTripErr } = await supabase.from('trips').delete().eq('id', id);
    if (delTripErr) throw delTripErr;

    res.json({ message: 'Trip deleted successfully' });
  } catch (err) {
    console.error('Delete Trip Error:', err);
    next(err);
  }
};

