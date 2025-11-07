// src/components/trips/ExpensesTab.js
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaPlus, FaTrash, FaDollarSign } from 'react-icons/fa';
import { expensesAPI, tripsAPI } from '../../services/api';
import { AddExpenseModal } from './AddExpenseModal';

export const ExpensesTab = ({ tripId }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetExpense, setTargetExpense] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadMembers = useCallback(async () => {
    try {
      const membersRes = await tripsAPI.getMembers(tripId);
      setMembers(membersRes.data || []);
    } catch (error) {
      console.error('Failed to load members', error);
    }
  }, [tripId]);

  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await expensesAPI.getTripExpenses(tripId);
      setExpenses(response.data);
    } catch (error) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadExpenses();
    loadMembers();
  }, [loadExpenses, loadMembers]);

  

  const openDeleteConfirm = (expense) => {
    setTargetExpense(expense);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!targetExpense) return;
    try {
      setDeleting(true);
      await expensesAPI.delete(targetExpense.id);
      toast.success('Expense deleted');
      setConfirmOpen(false);
      setTargetExpense(null);
      loadExpenses();
    } catch (error) {
      toast.error('Failed to delete expense');
    } finally {
      setDeleting(false);
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  if (loading) {
    return <div className="text-center py-8">Loading expenses...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Expenses</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Total: <span className="font-semibold text-primary-600">Rs {totalExpenses.toFixed(2)}</span>
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <FaPlus className="h-4 w-4" />
          <span>Add Expense</span>
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="card text-center py-12">
            <FaDollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No expenses yet. Add one to get started!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {expenses.map((expense) => (
            <motion.div
              key={expense.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card flex justify-between items-start"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {expense.description || 'No description'}
                  </h3>
                  <span className="text-xl font-bold text-primary-600">
                    Rs {parseFloat(expense.amount).toFixed(2)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p>Paid by: <span className="font-medium">{expense.payer_username}</span></p>
                  <p>
                    Participants: {expense.participants.join(', ')}
                  </p>
                  {expense.category && (
                    <span className="inline-block bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-1 rounded text-xs">
                      {expense.category}
                    </span>
                  )}
                  <p className="text-xs text-gray-500">
                    {new Date(expense.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              {expense.payer_username === JSON.parse(localStorage.getItem('user'))?.username && (
                <div className="ml-3 shrink-0 flex items-start">
                  <button
                    onClick={() => openDeleteConfirm(expense)}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full text-red-600 hover:text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                    aria-label="Delete expense"
                    title="Delete"
                  >
                    <FaTrash className="h-4 w-4" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <AddExpenseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={loadExpenses}
        tripId={tripId}
        members={members}
      />

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Expense</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete this expense?
            </p>
            {targetExpense && (
              <div className="mt-3 text-sm text-gray-800 dark:text-gray-200">
                <div className="flex justify-between">
                  <span className="font-medium">{targetExpense.description || 'No description'}</span>
                  <span className="font-semibold text-primary-600">Rs {parseFloat(targetExpense.amount).toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Paid by {targetExpense.payer_username}</p>
              </div>
            )}
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => { setConfirmOpen(false); setTargetExpense(null); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
