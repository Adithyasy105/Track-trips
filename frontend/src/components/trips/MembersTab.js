// src/components/trips/MembersTab.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaUsers, FaTrash } from 'react-icons/fa';
import { groupsAPI, tripsAPI } from '../../services/api';

export const MembersTab = ({ tripId, trip }) => {
  const [members, setMembers] = useState([]); // trip members
  const [groupMembers, setGroupMembers] = useState([]);
  const [newMember, setNewMember] = useState('');
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetMember, setTargetMember] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [settlementError, setSettlementError] = useState(null);

  useEffect(() => {
    loadMembers();
  }, [trip]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const groupId = trip?.groups?.id || trip?.group_id;
      if (!groupId) {
        toast.error('Group ID not found');
        return;
      }
      const [tripMemRes, groupMemRes] = await Promise.all([
        tripsAPI.getMembers(trip.id),
        groupsAPI.getMembers(groupId)
      ]);
      setMembers(tripMemRes.data || []);
      setGroupMembers(groupMemRes.data || []);
    } catch (error) {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (username) => {
    try {
      setRemoving(username);
      await tripsAPI.removeMember(trip.id, username);
      toast.success('Member removed from trip');
      setConfirmOpen(false);
      setTargetMember(null);
      setConfirmText('');
      loadMembers();
    } catch (e) {
      // Check if error is related to settlements
      if (e.response?.data?.settlements || e.response?.data?.error?.includes('settlement')) {
        setSettlementError({
          member: targetMember || { username },
          message: e.response?.data?.error || 'Member has pending settlements',
          details: e.response?.data?.settlements
        });
        setConfirmOpen(false);
      } else {
        toast.error(e.response?.data?.error || 'Failed to remove member');
      }
    } finally {
      setRemoving(null);
    }
  };

  const handleAddMember = async () => {
    try {
      if (!newMember) return;
      await tripsAPI.addMember(trip.id, newMember);
      toast.success('Member added to trip');
      setNewMember('');
      loadMembers();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add member');
    }
  };

  const openConfirm = (member) => {
    setTargetMember(member);
    setConfirmText('');
    setConfirmOpen(true);
  };

  const confirmAndRemove = async () => {
    if (!targetMember) return;
    if (confirmText !== targetMember.username) return;
    await handleRemove(targetMember.username);
    setConfirmOpen(false);
    setTargetMember(null);
  };

  if (loading) {
    return <div className="text-center py-8">Loading members...</div>;
  }

  const isCreator = trip?.created_by === JSON.parse(localStorage.getItem('user'))?.username;
  const availableForAdd = groupMembers.filter(gm => !members.find(m => m.username === gm.username));

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Trip Members</h2>
      {members.length === 0 ? (
        <div className="card text-center py-12">
          <FaUsers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No members found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isCreator && (
            <div className="md:col-span-2 lg:col-span-3">
              <div className="card flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add member to this trip</label>
                  <select
                    value={newMember}
                    onChange={(e) => setNewMember(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select a group member</option>
                    {availableForAdd.map((m) => (
                      <option key={m.username} value={m.username}>{m.full_name || m.username} (@{m.username})</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddMember}
                    disabled={!newMember}
                    className="btn-primary"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const toAdd = availableForAdd.map(m => m.username);
                        for (const u of toAdd) {
                          await tripsAPI.addMember(trip.id, u);
                        }
                        toast.success('All remaining members added');
                        loadMembers();
                      } catch (e) {
                        toast.error('Failed to add all members');
                      }
                    }}
                    disabled={availableForAdd.length === 0}
                    className="btn-secondary"
                  >
                    Add All
                  </button>
                </div>
              </div>
            </div>
          )}
          {members.map((member) => (
            <motion.div
              key={member.username}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                    <span className="text-primary-600 dark:text-primary-400 font-semibold">
                      {(member.full_name || member.username).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {member.full_name || member.username}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      @{member.username}
                    </p>
                    {member.email && (
                      <p className="text-xs text-gray-500">{member.email}</p>
                    )}
                  </div>
                </div>
                {isCreator && member.username !== trip?.created_by && (
                  <button
                    onClick={() => openConfirm(member)}
                    disabled={removing === member.username}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-full text-red-600 hover:text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                    title="Remove member"
                    aria-label="Remove member"
                  >
                    <FaTrash className="h-4 w-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Remove Member from Trip</h3>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              This will remove <span className="font-medium">@{targetMember?.username}</span> from this trip. They will no longer see this trip or its expenses. This action cannot be undone.
            </p>
            <p className="mt-3 text-xs text-gray-500">Type the username to confirm:</p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="input-field mt-2"
              placeholder={targetMember?.username || 'username'}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setConfirmOpen(false); setTargetMember(null); setConfirmText(''); }} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={confirmAndRemove}
                disabled={removing === targetMember?.username || confirmText !== (targetMember?.username || '')}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {removing === targetMember?.username ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Error Modal */}
      {settlementError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <FaUsers className="text-yellow-600 dark:text-yellow-400 text-xl" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Cannot Remove Member</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending Settlements in This Trip</p>
              </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-800 dark:text-gray-200 font-medium mb-2">
                @{settlementError.member?.username} has active settlements in this trip:
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {settlementError.message}
              </p>
            </div>

            {settlementError.details && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Settlement Details:</p>
                {settlementError.details.balance !== undefined && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Balance:</span>{' '}
                    {settlementError.details.balance > 0 ? (
                      <span className="text-green-600 dark:text-green-400">+${Math.abs(settlementError.details.balance).toFixed(2)} (owed to them)</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">-${Math.abs(settlementError.details.balance).toFixed(2)} (they owe)</span>
                    )}
                  </p>
                )}
                {settlementError.details.owes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <span className="font-medium">Owes to:</span> {settlementError.details.owes}
                  </p>
                )}
                {settlementError.details.owedBy && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <span className="font-medium">Owed by:</span> {settlementError.details.owedBy}
                  </p>
                )}
                {settlementError.details.settlementCount > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <span className="font-medium">Active transactions:</span> {settlementError.details.settlementCount}
                  </p>
                )}
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> All balances in this trip must be settled to $0.00 before a member can be removed from the trip.
              </p>
            </div>

            <button
              onClick={() => setSettlementError(null)}
              className="w-full btn-primary"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
