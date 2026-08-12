// src/pages/Dashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaPlus, FaUsers, FaMapMarkerAlt, FaCalendarAlt, FaLock, FaArrowRight } from 'react-icons/fa';
import { groupsAPI, tripsAPI } from '../services/api';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { CreateTripModal } from '../components/CreateTripModal';
import { JoinGroupModal } from '../components/JoinGroupModal';

export const Dashboard = () => {
  const [groups, setGroups] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [groupsRes, tripsData] = await Promise.all([
        groupsAPI.getMyGroups(),
        getAllTrips(),
      ]);
      setGroups(groupsRes.data || []);
      setTrips(tripsData || []);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getAllTrips = async () => {
    try {
      const groupsRes = await groupsAPI.getMyGroups();
      const allTrips = [];
      for (const group of groupsRes.data || []) {
        try {
          const tripsRes = await tripsAPI.getGroupTrips(group.id);
          allTrips.push(...(tripsRes.data || []).map((t) => ({ ...t, group_name: group.name })));
        } catch {
          // Skip empty
        }
      }
      return allTrips;
    } catch {
      return [];
    }
  };

  const handleGroupCreated = () => {
    loadData();
    setShowGroupModal(false);
  };

  const handleTripCreated = () => {
    loadData();
    setShowTripModal(false);
    setSelectedGroupId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-gray-500 dark:text-gray-400 text-sm">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <div className="rounded-[28px] border border-sky-200/70 bg-gradient-to-br from-sky-100 via-white to-blue-100 p-5 shadow-[0_20px_45px_-24px_rgba(2,132,199,0.35)] dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center rounded-full border border-sky-200 bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-sky-300">
              Travel Hub
            </div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white sm:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage your travel groups, trip plans, and shared expenses in one place.</p>
          </div>
          <div className="flex flex-nowrap items-center justify-end gap-2 sm:justify-start">
            <button
              onClick={() => setShowGroupModal(true)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-primary-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <FaPlus className="h-3.5 w-3.5" />
              <span>New Group</span>
            </button>
            <button
              onClick={() => setShowTripModal(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white/80 px-3 py-2.5 text-sm font-semibold text-sky-700 transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-sky-300"
            >
              <FaPlus className="h-3.5 w-3.5" />
              <span>New Trip</span>
            </button>
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white/80 px-3 py-2.5 text-sm font-semibold text-sky-700 transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-sky-300"
            >
              <FaUsers className="h-3.5 w-3.5" />
              <span>Join Group</span>
            </button>
          </div>
        </div>
      </div>

      {/* My Groups */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <FaUsers className="text-primary-500" /> My Groups ({groups.length})
          </h2>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-sky-200 bg-white/70 py-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800/70">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 dark:bg-slate-700">
              <FaUsers className="h-6 w-6 text-sky-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">No groups yet. Create or join one to get started!</p>
            <button onClick={() => setShowGroupModal(true)} className="rounded-2xl bg-gradient-to-r from-sky-600 to-primary-600 px-4 py-2 text-xs font-semibold text-white">
              <FaPlus className="mr-1.5 inline h-3 w-3" /> Create Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="group flex flex-col justify-between rounded-[24px] border border-sky-100 bg-white/90 p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_16px_35px_-18px_rgba(2,132,199,0.45)] dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-sky-600"
              >
                <Link to={`/groups/${group.id}`} className="block flex-1">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h3 className="truncate text-base font-bold text-gray-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                      {group.name}
                    </h3>
                    {group.has_password && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-300">
                        <FaLock className="h-2.5 w-2.5" /> Protected
                      </span>
                    )}
                  </div>
                  <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                    Created by <span className="font-medium text-gray-700 dark:text-gray-300">@{group.created_by}</span>
                  </p>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-xs font-semibold text-primary-600 dark:border-gray-700/60 dark:text-primary-400">
                    <span>View Group Hub</span>
                    <FaArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Trips */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <FaMapMarkerAlt className="text-primary-500" /> Recent Trips ({trips.length})
          </h2>
        </div>

        {trips.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-sky-200 bg-white/70 py-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800/70">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 dark:bg-slate-700">
              <FaMapMarkerAlt className="h-6 w-6 text-sky-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">No active trips. Create a trip inside your group!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="group flex flex-col justify-between rounded-[24px] border border-sky-100 bg-white/90 p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_16px_35px_-18px_rgba(2,132,199,0.45)] dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-sky-600"
              >
                <Link to={`/trips/${trip.id}`} className="block flex-1">
                  <div className="mb-3">
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                      {trip.group_name}
                    </span>
                  </div>
                  <h3 className="truncate text-base font-bold text-gray-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                    {trip.name}
                  </h3>
                  <p className="mb-3 mt-1 text-xs text-gray-500 dark:text-gray-400">By @{trip.created_by}</p>
                  <div className="space-y-1 border-t border-gray-100 pt-2 text-xs text-gray-600 dark:border-gray-700/60 dark:text-gray-300">
                    {trip.location && (
                      <div className="flex items-center gap-1.5 truncate">
                        <FaMapMarkerAlt className="h-3 w-3 flex-shrink-0 text-primary-500" />
                        <span className="truncate">{trip.location}</span>
                      </div>
                    )}
                    {trip.start_date && (
                      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                        <FaCalendarAlt className="h-3 w-3 flex-shrink-0 text-gray-400" />
                        <span>{new Date(trip.start_date).toLocaleDateString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <CreateGroupModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onSuccess={handleGroupCreated}
      />

      <CreateTripModal
        isOpen={showTripModal}
        onClose={() => {
          setShowTripModal(false);
          setSelectedGroupId(null);
        }}
        onSuccess={handleTripCreated}
        groups={groups}
        selectedGroupId={selectedGroupId}
      />

      <JoinGroupModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSuccess={handleGroupCreated}
      />
    </div>
  );
};

export default Dashboard;
