// src/components/trips/AddExpenseModal.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { expensesAPI, tripsAPI } from '../../services/api';

export const AddExpenseModal = ({ isOpen, onClose, onSuccess, tripId, members: initialMembers }) => {
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: '',
    participants: []
  });
  const [members, setMembers] = useState(initialMembers || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && !initialMembers) {
      loadMembers();
    } else if (initialMembers) {
      setMembers(initialMembers);
    }
  }, [isOpen, tripId]);

  const loadMembers = async () => {
    try {
      const membersRes = await tripsAPI.getMembers(tripId);
      setMembers(membersRes.data || []);
    } catch (error) {
      console.error('Failed to load members', error);
    }
  };

  const toggleParticipant = (username) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.includes(username)
        ? prev.participants.filter(p => p !== username)
        : [...prev.participants, username]
    }));
  };

  const selectAllParticipants = () => {
    const allUsernames = members.map(m => m.username);
    setFormData(prev => ({ ...prev, participants: allUsernames }));
  };

  const clearAllParticipants = () => {
    setFormData(prev => ({ ...prev, participants: [] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.participants.length === 0) {
      toast.error('Please select at least one participant');
      return;
    }

    setLoading(true);

    try {
      await expensesAPI.add({
        trip_id: tripId,
        amount: parseFloat(formData.amount),
        description: formData.description || undefined,
        category: formData.category || undefined,
        participants: formData.participants
      });
      toast.success('Expense added successfully!');
      setFormData({ amount: '', description: '', category: '', participants: [] });
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Expense</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FaTimes className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  placeholder="What was this expense for?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select category</option>
                  <option value="Food">Food</option>
                  <option value="Transport">Transport</option>
                  <option value="Accommodation">Accommodation</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Participants *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllParticipants}
                      className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearAllParticipants}
                      className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2">
                  {members.map((member) => (
                    <label
                      key={member.username}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={formData.participants.includes(member.username)}
                        onChange={() => toggleParticipant(member.username)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {member.full_name || member.username}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1"
                >
                  {loading ? 'Adding...' : 'Add Expense'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
