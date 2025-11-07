// src/controllers/analyticsController.js
import { supabase } from '../services/supabaseClient.js';

export const getTripAnalytics = async (req, res, next) => {
  try {
    const { trip_id } = req.params;
    const username = req.user.username;

    // Verify access to trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', trip_id)
      .single();

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

    // Get all expenses
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('*')
      .eq('trip_id', trip_id);

    if (expError) throw expError;

    // Get all trip members
    const { data: members, error: memError } = await supabase
      .from('trip_members')
      .select('username')
      .eq('trip_id', trip_id);

    if (memError) throw memError;
    // Ensure we have a valid array and create Set of trip member usernames
    const memberUsernames = new Set((members || []).map(m => m.username));
    
    // If no trip members, return empty response
    if (memberUsernames.size === 0) {
      return res.json({
        summary: {
          total_expenses: 0,
          total_expenses_count: 0,
          average_expense: 0
        },
        spending_per_user: {},
        spending_by_category: {},
        chart_data: {
          users: [],
          categories: []
        }
      });
    }

    // Filter expenses to only include those where payer and all participants are trip members
    const validExpenses = expenses.filter(expense => {
      // Check if payer is a trip member
      if (!memberUsernames.has(expense.payer_username)) {
        return false;
      }
      // Check if all participants are trip members
      if (expense.participants && expense.participants.length > 0) {
        return expense.participants.every(p => memberUsernames.has(p));
      }
      return true;
    });

    // Calculate total spent per user (only trip members)
    const spendingPerUser = {};
    // Only initialize for trip members
    Array.from(memberUsernames).forEach(username => {
      spendingPerUser[username] = 0;
    });

    validExpenses.forEach(expense => {
      // Only process if payer is a trip member
      if (memberUsernames.has(expense.payer_username)) {
        spendingPerUser[expense.payer_username] = 
          (spendingPerUser[expense.payer_username] || 0) + parseFloat(expense.amount);
      }
    });

    // Filter spendingPerUser to ONLY include trip members (remove any non-trip members)
    // This is a critical safety check - ensure ONLY trip members are in the response
    const filteredSpendingPerUser = {};
    memberUsernames.forEach(username => {
      // Only add if username exists in spendingPerUser AND is a trip member
      if (spendingPerUser.hasOwnProperty(username)) {
        filteredSpendingPerUser[username] = spendingPerUser[username] || 0;
      }
    });
    
    // Double-check: Remove any keys that aren't in trip members (safety net)
    Object.keys(filteredSpendingPerUser).forEach(key => {
      if (!memberUsernames.has(key)) {
        delete filteredSpendingPerUser[key];
      }
    });

    // Calculate spending by category (only from valid expenses)
    const spendingByCategory = {};
    validExpenses.forEach(expense => {
      const category = expense.category || 'Uncategorized';
      spendingByCategory[category] = 
        (spendingByCategory[category] || 0) + parseFloat(expense.amount);
    });

    // Final safety check: Ensure response only contains trip members
    // Create a clean response object with ONLY trip members
    const finalSpendingPerUser = {};
    memberUsernames.forEach(username => {
      if (filteredSpendingPerUser[username] !== undefined) {
        finalSpendingPerUser[username] = filteredSpendingPerUser[username];
      }
    });

    const categoryChartData = Object.keys(spendingByCategory).map(category => ({
      name: category,
      value: parseFloat(spendingByCategory[category].toFixed(2))
    }));

    const totalSpent = validExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    // Prepare chart data (only trip members)
    const userChartData = Object.keys(finalSpendingPerUser)
      .filter(username => finalSpendingPerUser[username] > 0)
      .map(username => ({
        name: username,
        value: parseFloat(finalSpendingPerUser[username].toFixed(2))
      }));

    res.json({
      summary: {
        total_expenses: parseFloat(totalSpent.toFixed(2)),
        total_expenses_count: validExpenses.length,
        average_expense: validExpenses.length > 0 
          ? parseFloat((totalSpent / validExpenses.length).toFixed(2)) 
          : 0
      },
      spending_per_user: finalSpendingPerUser, // Only trip members - guaranteed
      spending_by_category: spendingByCategory,
      chart_data: {
        users: userChartData,
        categories: categoryChartData
      }
    });
  } catch (err) {
    next(err);
  }
};
