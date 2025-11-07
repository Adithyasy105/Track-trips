// src/pages/GroupDetail.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaArrowLeft, FaPlus, FaUsers, FaMapMarkerAlt, FaTrash } from 'react-icons/fa';
import { groupsAPI, tripsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import QRCode from 'react-qr-code';
import { CreateTripModal } from '../components/CreateTripModal';
import { JoinGroupModal } from '../components/JoinGroupModal';

export const GroupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [trips, setTrips] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [copyingInvite, setCopyingInvite] = useState(false);
  const [nickname, setNickname] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState('');
  const [copyingId, setCopyingId] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwValue, setPwValue] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [memberConfirmOpen, setMemberConfirmOpen] = useState(false);
  const [memberTarget, setMemberTarget] = useState(null);
  const [memberConfirmText, setMemberConfirmText] = useState('');
  const [removingMember, setRemovingMember] = useState(null);
  const [settlementError, setSettlementError] = useState(null);

  const fadeInUp = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };
  const fadeIn = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.25 } },
  };

  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      const groupRes = await groupsAPI.getById(id);
      setGroup(groupRes.data);
      setIsMember(groupRes.data.is_member);

      if (groupRes.data.is_member) {
        const [tripsRes, membersRes] = await Promise.all([
          tripsAPI.getGroupTrips(id).catch(() => ({ data: [] })),
          groupsAPI.getMembers(id).catch(() => ({ data: [] }))
        ]);
        setTrips(tripsRes.data || []);
        setMembers(membersRes.data || []);
      } else {
        setShowJoinModal(true);
      }
    } catch (error) {
      toast.error('Failed to load group data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);

  const handleJoinSuccess = () => {
    setShowJoinModal(false);
    loadGroupData();
  };

  const handleTripCreated = () => {
    loadGroupData();
    setShowTripModal(false);
  };

  const handleDeleteGroup = async () => {
    if (!group) return;
    if (confirmValue !== group.name) return;
    try {
      setDeleting(true);
      await groupsAPI.delete(id);
      toast.success('Group deleted');
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete group');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setConfirmValue('');
    }
  };

  const buildInviteUrl = (token) => {
    const url = new URL(`${window.location.origin}/invite/${token}`);
    if (nickname) url.searchParams.set('nickname', nickname);
    return url.toString();
  };

  const handleCopyInvite = async () => {
    try {
      setCopyingInvite(true);
      const res = await groupsAPI.createInvite(id);
      const token = res.data.token;
      const inviteUrl = buildInviteUrl(token);
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Invite link copied to clipboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create invite');
    } finally {
      setCopyingInvite(false);
    }
  };

  const handleCopyGroupId = async () => {
    try {
      setCopyingId(true);
      await navigator.clipboard.writeText(id);
      toast.success('Group ID copied');
    } catch (e) {
      toast.error('Failed to copy Group ID');
    } finally {
      setCopyingId(false);
    }
  };

  const isGroupCreator = user && group && user.username === group.created_by;
  const openMemberConfirm = (member) => {
    setMemberTarget(member);
    setMemberConfirmText('');
    setMemberConfirmOpen(true);
  };
  const handleRemoveMember = async () => {
    if (!memberTarget) return;
    try {
      setRemovingMember(memberTarget.username);
      await groupsAPI.removeMember(id, memberTarget.username);
      toast.success('Member removed and related trips deleted');
      setMemberConfirmOpen(false);
      setMemberTarget(null);
      setMemberConfirmText('');
      loadGroupData();
    } catch (e) {
      // Check if error is related to settlements
      if (e.response?.data?.settlements || e.response?.data?.error?.includes('settlement')) {
        setSettlementError({
          member: memberTarget,
          message: e.response?.data?.error || 'Member has pending settlements',
          details: e.response?.data?.settlements
        });
        setMemberConfirmOpen(false);
      } else {
        toast.error(e.response?.data?.error || 'Failed to remove member');
      }
    } finally {
      setRemovingMember(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!group && !showJoinModal) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Group not found or you don't have access</p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
      >
        <FaArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </button>

      {group && (
        <>
          <motion.div
            className="card mb-6 bg-white dark:bg-gray-900 shadow-sm rounded-xl p-4 lg:p-5 max-w-6xl mx-auto"
            variants={fadeInUp}
            initial="hidden"
            animate="show"
          >
            <div className="flex flex-col gap-4">
              {/* Top Row: Name + Stats */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white break-words">{group.name}</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Created by <span className="font-medium">@{group.created_by}</span></p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {group.has_password && (
                      <span className="inline-flex items-center text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1.5"></span>
                        Password Protected
                      </span>
                    )}
                    <span className="inline-flex items-center text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                      <FaUsers className="h-3.5 w-3.5 mr-1" />
                      {members.length} {members.length === 1 ? 'Member' : 'Members'}
                    </span>
                  </div>
                </div>

                {/* Actions (primary) */}
                {isMember && (
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <motion.button
                      onClick={() => setShowTripModal(true)}
                      className="flex items-center justify-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 text-sm shadow transition-all w-full sm:w-auto"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <FaPlus className="h-3.5 w-3.5" />
                      <span>New Trip</span>
                    </motion.button>
                    {user && group.created_by === user.username && (
                      <motion.button
                        onClick={() => setConfirmOpen(true)}
                        className="flex items-center justify-center gap-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 text-sm shadow transition-all w-full sm:w-auto"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <FaTrash className="h-3.5 w-3.5" />
                        <span>Delete Group</span>
                      </motion.button>
                    )}
                  </div>
                )}
              </div>

              {/* Meta Row: IDs and password controls */}
              {user && group.created_by === user.username && (
                <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-600 dark:text-gray-400 shrink-0">Group ID:</span>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded break-all">
                      {id}
                    </code>
                    <button onClick={handleCopyGroupId} className="btn-secondary text-xs px-2 py-1 shrink-0">
                      {copyingId ? 'Copying…' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.has_password ? (
                      <>
                        <span className="text-xs text-gray-600 dark:text-gray-400">Password is set</span>
                        <button onClick={() => setPwOpen(true)} className="btn-secondary text-xs px-2 py-1">Change Password</button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-600 dark:text-gray-400">No password</span>
                        <button onClick={() => setPwOpen(true)} className="btn-secondary text-xs px-2 py-1">Set Password</button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Invite controls */}
              {isMember && (
                <motion.div className="flex flex-col sm:flex-row gap-2 items-stretch w-full min-w-0" variants={fadeIn} initial="hidden" animate="show">
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Nickname (optional)"
                    className="w-full sm:w-64 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm px-2.5 py-1.5 transition-all min-w-0"
                  />
                  <button
                    onClick={handleCopyInvite}
                    disabled={copyingInvite}
                    className={`w-full sm:w-auto rounded-md text-sm font-medium py-2 px-4 shadow-sm transition-all ${
                      copyingInvite
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white'
                    }`}
                  >
                    {copyingInvite ? 'Copying…' : 'Copy Invite Link'}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
          {/* Members Section */}
          <div className="card mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Members</h2>
            {members.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">No members found</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {members.map((member, idx) => (
                  <motion.div
                    key={member.username}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-gray-900"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="show"
                    transition={{ delay: Math.min(idx * 0.03, 0.15) }}
                    whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                      <span className="text-primary-600 dark:text-primary-400 font-semibold">
                        {(member.full_name || member.username).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {member.full_name || member.username}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">@{member.username}</p>
                    </div>
                    {isGroupCreator && member.username !== group.created_by && (
                      <button
                        onClick={() => openMemberConfirm(member)}
                        disabled={removingMember === member.username}
                        className="ml-auto inline-flex items-center justify-center h-8 w-8 rounded-full text-red-600 hover:text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                        title="Remove member"
                        aria-label="Remove member"
                      >
                        <FaTrash className="h-4 w-4" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Invite QR (members only) */}
          {isMember && (
            <motion.div className="card mb-6" variants={fadeInUp} initial="hidden" animate="show">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Invite via QR</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Share this QR to let friends join quickly.</p>
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <motion.div className="bg-white p-3 rounded-lg shadow border border-gray-200" whileHover={{ scale: 1.01 }}>
                  {/* QR code value will be built dynamically on click; show latest created if any */}
                  {/* For a live QR, we request a fresh token */}
                  <LiveInviteQR groupId={id} nickname={nickname} />
                </motion.div>
                <div className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
                  <p>Tip: add a nickname to prefill their signup.</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Trips Section */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Trips</h2>
            {trips.length === 0 ? (
              <div className="card text-center py-10">
                <FaMapMarkerAlt className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">No trips yet. Create one to get started!</p>
                {isMember && (
                  <button
                    onClick={() => setShowTripModal(true)}
                    className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 text-sm shadow transition-all"
                  >
                    <FaPlus className="h-3.5 w-3.5" />
                    <span>New Trip</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trips.map((trip) => (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card hover:shadow-lg transition-all cursor-pointer border border-gray-200 dark:border-gray-800"
                    onClick={() => navigate(`/trips/${trip.id}`)}
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {trip.name}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Created by <span className="font-medium">@{trip.created_by}</span></p>
                    {trip.location && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <FaMapMarkerAlt className="h-4 w-4 mr-1" />
                        {trip.location}
                      </div>
                    )}
                    {trip.start_date && (
                      <p className="text-xs text-gray-500">
                        {new Date(trip.start_date).toLocaleDateString()}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <CreateTripModal
        isOpen={showTripModal}
        onClose={() => setShowTripModal(false)}
        onSuccess={handleTripCreated}
        groups={group ? [group] : []}
        selectedGroupId={id}
      />

      <JoinGroupModal
        isOpen={showJoinModal}
        onClose={() => {
          setShowJoinModal(false);
          navigate('/dashboard');
        }}
        onSuccess={handleJoinSuccess}
        groupId={id}
      />
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Delete Group</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              This action cannot be undone. Please type the group name to confirm:
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{group?.name}</p>
            <input
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              className="input-field mt-3"
              placeholder="Type group name exactly"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setConfirmOpen(false); setConfirmValue(''); }} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleDeleteGroup}
                disabled={deleting || confirmValue !== (group?.name || '')}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Change Group Password</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Leave empty to remove password.</p>
            <input
              type="password"
              value={pwValue}
              onChange={(e) => setPwValue(e.target.value)}
              className="input-field mt-3"
              placeholder="New password (min 6) or empty to remove"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setPwOpen(false); setPwValue(''); }} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={async () => {
                  try {
                    setPwLoading(true);
                    await groupsAPI.updatePassword(id, pwValue.trim() === '' ? null : pwValue);
                    toast.success(pwValue.trim() === '' ? 'Password removed' : 'Password updated');
                    setPwOpen(false);
                    setPwValue('');
                    loadGroupData();
                  } catch (e) {
                    toast.error(e.response?.data?.error || 'Failed to update password');
                  } finally {
                    setPwLoading(false);
                  }
                }}
                disabled={pwLoading}
                className="btn-primary flex-1"
              >
                {pwLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {memberConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Remove Member</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              This will remove <span className="font-medium">@{memberTarget?.username}</span> from the group and delete all trips they created or participated in within this group. This action cannot be undone.
            </p>
            <p className="mt-2 text-xs text-gray-500">Type the username to confirm:</p>
            <input
              value={memberConfirmText}
              onChange={(e) => setMemberConfirmText(e.target.value)}
              className="input-field mt-3"
              placeholder={memberTarget?.username || 'username'}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setMemberConfirmOpen(false); setMemberTarget(null); setMemberConfirmText(''); }} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleRemoveMember}
                disabled={removingMember === memberTarget?.username || memberConfirmText !== (memberTarget?.username || '')}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {removingMember === memberTarget?.username ? 'Removing…' : 'Remove'}
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
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending Settlements Detected</p>
              </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-800 dark:text-gray-200 font-medium mb-2">
                @{settlementError.member?.username} has active settlements:
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
                <strong>Note:</strong> All balances must be settled to $0.00 before a member can be removed from the group.
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

// Helper component to render a fresh QR code by fetching a new invite token
const LiveInviteQR = ({ groupId, nickname }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const qrWrapperRef = useRef(null);

  const buildUrl = useCallback((token) => {
    const u = new URL(`${window.location.origin}/invite/${token}`);
    if (nickname) u.searchParams.set('nickname', nickname);
    return u.toString();
  }, [nickname]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await groupsAPI.createInvite(groupId);
      setUrl(buildUrl(res.data.token));
    } catch (e) {
      // ignore; GroupDetail toasts on copy flow
    } finally {
      setLoading(false);
    }
  }, [groupId, buildUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col items-center">
      {url ? (
        <div ref={qrWrapperRef}>
          <QRCode value={url} size={160} fgColor="#0f172a" bgColor="#ffffff" />
        </div>
      ) : (
        <div className="h-[160px] w-[160px] flex items-center justify-center text-xs text-gray-500">
          Generating QR…
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <button onClick={refresh} className="btn-secondary" disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh QR'}
        </button>
        <button
          className="btn-primary"
          onClick={() => {
            try {
              const wrapper = qrWrapperRef.current;
              if (!wrapper) return;
              const svg = wrapper.querySelector('svg');
              if (!svg) return;
              const serializer = new XMLSerializer();
              let source = serializer.serializeToString(svg);
              if (!source.match(/^<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/)) {
                source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
              }
              source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
              const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
              const urlObj = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = urlObj;
              a.download = `group-${groupId}-qr.svg`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(urlObj);
            } catch (_) {
              // no-op
            }
          }}
        >
          Download QR
        </button>
      </div>
      {url && (
        <p className="mt-2 text-xs break-all max-w-xs text-gray-500 dark:text-gray-400">
          {url}
        </p>
      )}
    </div>
  );
};
