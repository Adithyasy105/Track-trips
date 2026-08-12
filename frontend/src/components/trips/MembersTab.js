// src/components/trips/MembersTab.js

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import {
  motion,
  AnimatePresence,
} from 'framer-motion';

import toast from 'react-hot-toast';

import {
  FaUsers,
  FaTrash,
  FaUserPlus,
  FaUserCheck,
  FaCheckCircle,
  FaUserShield,
  FaExclamationTriangle,
  FaTimes,
  FaBalanceScale,
} from 'react-icons/fa';

import {
  groupsAPI,
  tripsAPI,
} from '../../services/api';

/* ============================================================
   HELPERS
============================================================ */

const getStoredUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem('user') || 'null'
    );
  } catch {
    return null;
  }
};

const getInitials = (name = '') => {
  const value = String(name || '').trim();

  if (!value) {
    return 'U';
  }

  const parts = value.split(/\s+/);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return value
    .slice(0, 2)
    .toUpperCase();
};

/* ============================================================
   REUSABLE ICON BOX
============================================================ */

const IconBox = ({
  children,
  size = 'h-9 w-9',
  className = '',
}) => {
  return (
    <div
      className={`
        flex
        ${size}
        shrink-0
        items-center
        justify-center
        rounded-xl
        bg-primary-100
        text-primary-600
        dark:bg-primary-900/40
        dark:text-primary-400
        ${className}
      `}
    >
      {children}
    </div>
  );
};

/* ============================================================
   MEMBER AVATAR
============================================================ */

const MemberAvatar = ({
  name,
  creator = false,
  size = 'h-12 w-12',
}) => {
  return (
    <div
      className={`
        relative
        flex
        ${size}
        shrink-0
        items-center
        justify-center
        rounded-2xl
        bg-primary-600
        text-white
        shadow-sm
      `}
    >
      <span className="text-sm font-bold tracking-tight">
        {getInitials(name)}
      </span>

      {creator && (
        <span
          className="
            absolute
            -right-1
            -top-1
            flex
            h-5
            w-5
            items-center
            justify-center
            rounded-full
            border-2
            border-white
            bg-primary-600
            text-white
            shadow-sm
            dark:border-gray-900
          "
          title="Trip creator"
        >
          <FaUserShield className="h-2.5 w-2.5" />
        </span>
      )}
    </div>
  );
};

/* ============================================================
   COMPONENT
============================================================ */

export const MembersTab = ({
  tripId,
  trip,
}) => {
  const [members, setMembers] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);

  const [newMember, setNewMember] = useState('');

  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetMember, setTargetMember] = useState(null);
  const [confirmText, setConfirmText] = useState('');

  const [settlementError, setSettlementError] =
    useState(null);

  const [showAddPanel, setShowAddPanel] =
    useState(false);

  /* ==========================================================
     CURRENT USER
  ========================================================== */

  const currentUser = useMemo(
    () => getStoredUser(),
    []
  );

  /* ==========================================================
     LOAD MEMBERS
  ========================================================== */

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);

      const groupId =
        trip?.groups?.id ||
        trip?.group_id;

      if (!groupId) {
        toast.error('Group ID not found');
        return;
      }

      const [
        tripMemRes,
        groupMemRes,
      ] = await Promise.all([
        tripsAPI.getMembers(trip.id),
        groupsAPI.getMembers(groupId),
      ]);

      setMembers(
        tripMemRes?.data || []
      );

      setGroupMembers(
        groupMemRes?.data || []
      );
    } catch (error) {
      console.error(
        'Failed to load members:',
        error
      );

      toast.error(
        'Failed to load members'
      );
    } finally {
      setLoading(false);
    }
  }, [trip]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  /* ==========================================================
     CREATOR
  ========================================================== */

  const isCreator =
    trip?.created_by ===
    currentUser?.username;

  /* ==========================================================
     AVAILABLE MEMBERS
  ========================================================== */

  const availableForAdd = useMemo(() => {
    return groupMembers.filter(
      (groupMember) =>
        !members.some(
          (member) =>
            member.username ===
            groupMember.username
        )
    );
  }, [
    groupMembers,
    members,
  ]);

  /* ==========================================================
     REMOVE MEMBER
  ========================================================== */

  const handleRemove = async (
    username
  ) => {
    try {
      setRemoving(username);

      await tripsAPI.removeMember(
        trip.id,
        username
      );

      toast.success(
        'Member removed from trip'
      );

      setConfirmOpen(false);
      setTargetMember(null);
      setConfirmText('');

      await loadMembers();
    } catch (error) {
      console.error(
        'Failed to remove member:',
        error
      );

      const errorText =
        error?.response?.data?.error ||
        '';

      if (
        error?.response?.data?.settlements ||
        errorText
          .toLowerCase()
          .includes('settlement')
      ) {
        setSettlementError({
          member:
            targetMember || {
              username,
            },
          message:
            errorText ||
            'Member has pending settlements',
          details:
            error?.response?.data
              ?.settlements,
        });

        setConfirmOpen(false);
      } else {
        toast.error(
          errorText ||
            'Failed to remove member'
        );
      }
    } finally {
      setRemoving(null);
    }
  };

  /* ==========================================================
     ADD MEMBER
  ========================================================== */

  const handleAddMember = async () => {
    try {
      if (!newMember) {
        return;
      }

      await tripsAPI.addMember(
        trip.id,
        newMember
      );

      toast.success(
        'Member added to trip'
      );

      setNewMember('');

      await loadMembers();
    } catch (error) {
      console.error(
        'Failed to add member:',
        error
      );

      toast.error(
        error?.response?.data?.error ||
          'Failed to add member'
      );
    }
  };

  /* ==========================================================
     ADD ALL MEMBERS
  ========================================================== */

  const handleAddAll = async () => {
    try {
      const toAdd =
        availableForAdd.map(
          (member) =>
            member.username
        );

      if (!toAdd.length) {
        return;
      }

      for (const username of toAdd) {
        await tripsAPI.addMember(
          trip.id,
          username
        );
      }

      toast.success(
        'All remaining members added'
      );

      setNewMember('');

      await loadMembers();
    } catch (error) {
      console.error(
        'Failed to add all members:',
        error
      );

      toast.error(
        'Failed to add all members'
      );
    }
  };

  /* ==========================================================
     CONFIRMATION
  ========================================================== */

  const openConfirm = (
    member
  ) => {
    setTargetMember(member);
    setConfirmText('');
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (removing) {
      return;
    }

    setConfirmOpen(false);
    setTargetMember(null);
    setConfirmText('');
  };

  const confirmAndRemove = async () => {
    if (!targetMember) {
      return;
    }

    if (
      confirmText !==
      targetMember.username
    ) {
      return;
    }

    await handleRemove(
      targetMember.username
    );
  };

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <div className="w-full space-y-6">

        <div className="animate-pulse">
          <div className="h-8 w-44 rounded-xl bg-gray-200 dark:bg-gray-800" />

          <div className="mt-2 h-4 w-60 rounded bg-gray-100 dark:bg-gray-800" />
        </div>

        <div
          className="
            grid
            grid-cols-1
            gap-3
            sm:grid-cols-2
            xl:grid-cols-3
          "
        >
          {[
            1,
            2,
            3,
            4,
            5,
            6,
          ].map((item) => (
            <div
              key={item}
              className="
                h-32
                animate-pulse
                rounded-2xl
                border
                border-gray-200
                bg-gray-100
                dark:border-gray-800
                dark:bg-gray-800
              "
            />
          ))}
        </div>
      </div>
    );
  }

  /* ==========================================================
     MAIN
  ========================================================== */

  return (
    <div className="w-full space-y-5 sm:space-y-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <motion.div
        initial={{
          opacity: 0,
          y: 8,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.3,
        }}
        className="
          flex
          flex-col
          gap-4
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        <div className="flex min-w-0 items-center gap-3">

          <IconBox
            size="h-10 w-10"
          >
            <FaUsers className="h-4 w-4" />
          </IconBox>

          <div className="min-w-0">

            <h2
              className="
                truncate
                text-lg
                font-bold
                tracking-tight
                text-gray-900
                dark:text-white
                sm:text-xl
              "
            >
              Trip Members
            </h2>

            <p
              className="
                mt-0.5
                text-xs
                text-gray-500
                dark:text-gray-400
                sm:text-sm
              "
            >
              {members.length}{' '}
              {members.length === 1
                ? 'member'
                : 'members'}{' '}
              in this trip
            </p>

          </div>
        </div>

        {isCreator && (
          <button
            type="button"
            onClick={() =>
              setShowAddPanel(
                (previous) =>
                  !previous
              )
            }
            className="
              inline-flex
              w-full
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-primary-600
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition-all
              duration-200
              hover:-translate-y-0.5
              hover:bg-primary-700
              hover:shadow-md
              focus:outline-none
              focus:ring-2
              focus:ring-primary-500/30
              focus:ring-offset-2
              dark:focus:ring-offset-gray-900
              sm:w-auto
            "
          >
            {showAddPanel ? (
              <FaTimes className="h-3.5 w-3.5" />
            ) : (
              <FaUserPlus className="h-3.5 w-3.5" />
            )}

            <span>
              {showAddPanel
                ? 'Close'
                : 'Add Member'}
            </span>
          </button>
        )}
      </motion.div>

      {/* ======================================================
          ADD MEMBER PANEL
      ====================================================== */}

      <AnimatePresence initial={false}>
        {isCreator &&
          showAddPanel && (
            <motion.div
              initial={{
                opacity: 0,
                height: 0,
                y: -8,
              }}
              animate={{
                opacity: 1,
                height: 'auto',
                y: 0,
              }}
              exit={{
                opacity: 0,
                height: 0,
                y: -8,
              }}
              transition={{
                duration: 0.25,
                ease: 'easeOut',
              }}
              className="overflow-hidden"
            >
              <div
                className="
                  overflow-hidden
                  rounded-2xl
                  border
                  border-primary-100
                  bg-white
                  p-4
                  shadow-sm
                  dark:border-primary-900/50
                  dark:bg-gray-900
                  sm:p-5
                "
              >

                {/* PANEL HEADER */}

                <div className="mb-4 flex items-start gap-3">

                  <IconBox>
                    <FaUserPlus className="h-3.5 w-3.5" />
                  </IconBox>

                  <div className="min-w-0">

                    <h3
                      className="
                        text-sm
                        font-bold
                        text-gray-900
                        dark:text-white
                      "
                    >
                      Add people to this trip
                    </h3>

                    <p
                      className="
                        mt-0.5
                        text-xs
                        leading-5
                        text-gray-500
                        dark:text-gray-400
                      "
                    >
                      Select someone from your
                      group members.
                    </p>

                  </div>
                </div>

                {/* ALL MEMBERS ALREADY ADDED */}

                {availableForAdd.length ===
                0 ? (
                  <div
                    className="
                      flex
                      items-start
                      gap-3
                      rounded-xl
                      border
                      border-primary-100
                      bg-primary-50
                      px-4
                      py-3
                      dark:border-primary-900/50
                      dark:bg-primary-950/30
                    "
                  >
                    <FaCheckCircle
                      className="
                        mt-0.5
                        shrink-0
                        text-primary-600
                        dark:text-primary-400
                      "
                    />

                    <p
                      className="
                        text-sm
                        font-medium
                        text-primary-700
                        dark:text-primary-300
                      "
                    >
                      Everyone from the group is
                      already in this trip.
                    </p>
                  </div>
                ) : (
                  <div
                    className="
                      flex
                      flex-col
                      gap-3
                      lg:flex-row
                      lg:items-end
                    "
                  >

                    {/* SELECT */}

                    <div className="min-w-0 flex-1">

                      <label
                        htmlFor="trip-member-select"
                        className="
                          mb-2
                          block
                          text-[11px]
                          font-bold
                          uppercase
                          tracking-wider
                          text-gray-500
                          dark:text-gray-400
                        "
                      >
                        Group member
                      </label>

                      <select
                        id="trip-member-select"
                        value={newMember}
                        onChange={(event) =>
                          setNewMember(
                            event.target.value
                          )
                        }
                        className="
                          w-full
                          rounded-xl
                          border
                          border-gray-200
                          bg-gray-50
                          px-3.5
                          py-2.5
                          text-sm
                          text-gray-800
                          outline-none
                          transition
                          focus:border-primary-500
                          focus:bg-white
                          focus:ring-2
                          focus:ring-primary-500/20
                          dark:border-gray-700
                          dark:bg-gray-800
                          dark:text-white
                          dark:focus:bg-gray-800
                        "
                      >
                        <option value="">
                          Select a member
                        </option>

                        {availableForAdd.map(
                          (member) => (
                            <option
                              key={
                                member.username
                              }
                              value={
                                member.username
                              }
                            >
                              {member.full_name ||
                                member.username}{' '}
                              (@
                              {member.username})
                            </option>
                          )
                        )}
                      </select>

                    </div>

                    {/* ACTIONS */}

                    <div
                      className="
                        grid
                        grid-cols-2
                        gap-2
                        lg:w-auto
                      "
                    >

                      <button
                        type="button"
                        onClick={
                          handleAddMember
                        }
                        disabled={!newMember}
                        className="
                          inline-flex
                          items-center
                          justify-center
                          gap-2
                          rounded-xl
                          bg-primary-600
                          px-4
                          py-2.5
                          text-sm
                          font-semibold
                          text-white
                          transition
                          hover:bg-primary-700
                          disabled:cursor-not-allowed
                          disabled:opacity-40
                        "
                      >
                        <FaUserPlus className="h-3 w-3" />
                        Add
                      </button>

                      <button
                        type="button"
                        onClick={
                          handleAddAll
                        }
                        disabled={
                          availableForAdd.length ===
                          0
                        }
                        className="
                          inline-flex
                          items-center
                          justify-center
                          gap-2
                          rounded-xl
                          border
                          border-gray-200
                          bg-white
                          px-4
                          py-2.5
                          text-sm
                          font-semibold
                          text-gray-700
                          transition
                          hover:border-primary-200
                          hover:bg-primary-50
                          hover:text-primary-700
                          disabled:cursor-not-allowed
                          disabled:opacity-40
                          dark:border-gray-700
                          dark:bg-gray-800
                          dark:text-gray-200
                          dark:hover:border-primary-800
                          dark:hover:bg-primary-950/30
                          dark:hover:text-primary-300
                        "
                      >
                        Add All
                      </button>

                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* ======================================================
          EMPTY STATE
      ====================================================== */}

      {members.length === 0 ? (
        <motion.div
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="
            flex
            min-h-[300px]
            flex-col
            items-center
            justify-center
            rounded-2xl
            border
            border-dashed
            border-gray-300
            bg-white
            px-6
            text-center
            dark:border-gray-700
            dark:bg-gray-900
          "
        >

          <IconBox
            size="h-16 w-16"
            className="rounded-2xl"
          >
            <FaUsers className="h-7 w-7" />
          </IconBox>

          <h3
            className="
              mt-5
              text-lg
              font-bold
              text-gray-900
              dark:text-white
            "
          >
            No members yet
          </h3>

          <p
            className="
              mt-2
              max-w-sm
              text-sm
              leading-6
              text-gray-500
              dark:text-gray-400
            "
          >
            Add members from your group to start
            splitting expenses together.
          </p>

          {isCreator && (
            <button
              type="button"
              onClick={() =>
                setShowAddPanel(true)
              }
              className="
                mt-6
                inline-flex
                items-center
                gap-2
                rounded-xl
                bg-primary-600
                px-5
                py-2.5
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-primary-700
              "
            >
              <FaUserPlus className="h-3.5 w-3.5" />
              Add Member
            </button>
          )}

        </motion.div>
      ) : (
        <>
          {/* ==================================================
              SUMMARY
          ================================================== */}

          <motion.div
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.3,
              delay: 0.05,
            }}
            className="
              grid
              grid-cols-2
              gap-3
              sm:grid-cols-3
            "
          >

            {/* MEMBERS */}

            <div
              className="
                rounded-2xl
                border
                border-gray-200
                bg-white
                p-4
                shadow-sm
                dark:border-gray-700
                dark:bg-gray-900
              "
            >
              <div className="flex items-center gap-2">

                <IconBox size="h-8 w-8">
                  <FaUsers className="h-3.5 w-3.5" />
                </IconBox>

                <span
                  className="
                    text-xs
                    font-medium
                    text-gray-500
                    dark:text-gray-400
                  "
                >
                  Members
                </span>

              </div>

              <p
                className="
                  mt-3
                  text-2xl
                  font-bold
                  text-gray-900
                  dark:text-white
                "
              >
                {members.length}
              </p>
            </div>

            {/* CREATOR */}

            <div
              className="
                rounded-2xl
                border
                border-gray-200
                bg-white
                p-4
                shadow-sm
                dark:border-gray-700
                dark:bg-gray-900
              "
            >
              <div className="flex items-center gap-2">

                <IconBox size="h-8 w-8">
                  <FaUserShield className="h-3.5 w-3.5" />
                </IconBox>

                <span
                  className="
                    text-xs
                    font-medium
                    text-gray-500
                    dark:text-gray-400
                  "
                >
                  Creator
                </span>

              </div>

              <p
                className="
                  mt-3
                  truncate
                  text-sm
                  font-bold
                  text-gray-900
                  dark:text-white
                "
              >
                @{trip?.created_by || '—'}
              </p>
            </div>

            {/* GROUP AVAILABLE */}

            <div
              className="
                col-span-2
                rounded-2xl
                border
                border-gray-200
                bg-white
                p-4
                shadow-sm
                dark:border-gray-700
                dark:bg-gray-900
                sm:col-span-1
              "
            >
              <div className="flex items-center gap-2">

                <IconBox size="h-8 w-8">
                  <FaUserCheck className="h-3.5 w-3.5" />
                </IconBox>

                <span
                  className="
                    text-xs
                    font-medium
                    text-gray-500
                    dark:text-gray-400
                  "
                >
                  Group Available
                </span>

              </div>

              <p
                className="
                  mt-3
                  text-2xl
                  font-bold
                  text-gray-900
                  dark:text-white
                "
              >
                {availableForAdd.length}
              </p>
            </div>

          </motion.div>

          {/* ==================================================
              MEMBER GRID
          ================================================== */}

          <div
            className="
              grid
              grid-cols-1
              gap-3
              sm:grid-cols-2
              lg:gap-4
              xl:grid-cols-3
            "
          >

            {members.map(
              (
                member,
                index
              ) => {
                const memberIsCreator =
                  member.username ===
                  trip?.created_by;

                const canRemove =
                  isCreator &&
                  !memberIsCreator;

                return (
                  <motion.article
                    key={
                      member.username
                    }
                    initial={{
                      opacity: 0,
                      y: 12,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      duration: 0.3,
                      delay: Math.min(
                        index * 0.04,
                        0.2
                      ),
                    }}
                    whileHover={{
                      y: -2,
                    }}
                    className="
                      group
                      relative
                      overflow-hidden
                      rounded-2xl
                      border
                      border-gray-200
                      bg-white
                      shadow-sm
                      transition-shadow
                      duration-200
                      hover:shadow-md
                      dark:border-gray-700
                      dark:bg-gray-900
                    "
                  >

                    {/* TOP BLUE ACCENT */}

                    <div
                      className="
                        absolute
                        inset-x-0
                        top-0
                        h-1
                        bg-primary-600
                      "
                    />

                    <div className="p-4">

                      {/* MEMBER INFO */}

                      <div className="flex items-start gap-3">

                        <MemberAvatar
                          name={
                            member.full_name ||
                            member.username
                          }
                          creator={
                            memberIsCreator
                          }
                        />

                        <div className="min-w-0 flex-1">

                          <div
                            className="
                              flex
                              items-start
                              justify-between
                              gap-2
                            "
                          >

                            <div className="min-w-0">

                              <h3
                                className="
                                  truncate
                                  text-sm
                                  font-bold
                                  text-gray-900
                                  dark:text-white
                                "
                              >
                                {member.full_name ||
                                  member.username}
                              </h3>

                              <p
                                className="
                                  mt-0.5
                                  truncate
                                  text-xs
                                  text-gray-500
                                  dark:text-gray-400
                                "
                              >
                                @{member.username}
                              </p>

                            </div>

                            {/* CREATOR */}

                            {memberIsCreator && (
                              <span
                                className="
                                  shrink-0
                                  rounded-full
                                  bg-primary-50
                                  px-2
                                  py-1
                                  text-[9px]
                                  font-bold
                                  uppercase
                                  tracking-wide
                                  text-primary-700
                                  dark:bg-primary-950/50
                                  dark:text-primary-300
                                "
                              >
                                Creator
                              </span>
                            )}

                          </div>

                          {member.email && (
                            <p
                              className="
                                mt-2
                                truncate
                                text-[11px]
                                text-gray-400
                                dark:text-gray-500
                              "
                            >
                              {member.email}
                            </p>
                          )}

                        </div>

                      </div>

                      {/* FOOTER */}

                      <div
                        className="
                          mt-4
                          flex
                          min-h-[32px]
                          items-center
                          justify-between
                          gap-3
                          border-t
                          border-gray-100
                          pt-3
                          dark:border-gray-800
                        "
                      >

                        <div
                          className="
                            inline-flex
                            min-w-0
                            items-center
                            gap-1.5
                            text-[11px]
                            font-medium
                            text-gray-500
                            dark:text-gray-400
                          "
                        >
                          <FaCheckCircle
                            className="
                              shrink-0
                              text-primary-600
                              dark:text-primary-400
                            "
                          />

                          <span>
                            Trip member
                          </span>
                        </div>

                        {canRemove && (
                          <button
                            type="button"
                            onClick={() =>
                              openConfirm(
                                member
                              )
                            }
                            disabled={
                              removing ===
                              member.username
                            }
                            className="
                              inline-flex
                              shrink-0
                              items-center
                              gap-1.5
                              rounded-lg
                              px-2.5
                              py-1.5
                              text-[11px]
                              font-semibold
                              text-red-500
                              transition
                              hover:bg-red-50
                              hover:text-red-600
                              disabled:cursor-not-allowed
                              disabled:opacity-40
                              dark:text-red-400
                              dark:hover:bg-red-950/30
                            "
                          >
                            <FaTrash className="h-3 w-3" />
                            Remove
                          </button>
                        )}

                      </div>

                    </div>
                  </motion.article>
                );
              }
            )}

          </div>
        </>
      )}

      {/* ======================================================
          REMOVE CONFIRMATION MODAL
      ====================================================== */}

      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="
              fixed
              inset-0
              z-[100]
              flex
              items-center
              justify-center
              overflow-y-auto
              bg-black/50
              p-4
              backdrop-blur-sm
            "
            onMouseDown={
              closeConfirm
            }
          >

            <motion.div
              initial={{
                opacity: 0,
                scale: 0.96,
                y: 10,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
                y: 10,
              }}
              transition={{
                duration: 0.2,
              }}
              onMouseDown={(event) =>
                event.stopPropagation()
              }
              className="
                w-full
                max-w-md
                overflow-hidden
                rounded-2xl
                border
                border-gray-200
                bg-white
                shadow-2xl
                dark:border-gray-700
                dark:bg-gray-900
              "
            >

              {/* MODAL HEADER */}

              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-4
                  border-b
                  border-gray-100
                  p-5
                  dark:border-gray-800
                "
              >

                <div className="flex items-center gap-3">

                  <div
                    className="
                      flex
                      h-11
                      w-11
                      shrink-0
                      items-center
                      justify-center
                      rounded-xl
                      bg-red-50
                      text-red-500
                      dark:bg-red-950/30
                      dark:text-red-400
                    "
                  >
                    <FaExclamationTriangle className="h-5 w-5" />
                  </div>

                  <div>

                    <h3
                      className="
                        text-base
                        font-bold
                        text-gray-900
                        dark:text-white
                      "
                    >
                      Remove member?
                    </h3>

                    <p
                      className="
                        mt-0.5
                        text-xs
                        text-gray-500
                        dark:text-gray-400
                      "
                    >
                      This action cannot be undone.
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={
                    closeConfirm
                  }
                  disabled={
                    Boolean(removing)
                  }
                  className="
                    flex
                    h-8
                    w-8
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    text-gray-400
                    transition
                    hover:bg-gray-100
                    hover:text-gray-600
                    disabled:opacity-40
                    dark:hover:bg-gray-800
                  "
                  aria-label="Close"
                >
                  <FaTimes className="h-3.5 w-3.5" />
                </button>

              </div>

              {/* MODAL BODY */}

              <div className="p-5">

                <div
                  className="
                    rounded-xl
                    border
                    border-gray-200
                    bg-gray-50
                    p-3.5
                    dark:border-gray-700
                    dark:bg-gray-800
                  "
                >

                  <div className="flex items-center gap-3">

                    <MemberAvatar
                      name={
                        targetMember?.full_name ||
                        targetMember?.username
                      }
                    />

                    <div className="min-w-0">

                      <p
                        className="
                          truncate
                          text-sm
                          font-bold
                          text-gray-900
                          dark:text-white
                        "
                      >
                        {targetMember?.full_name ||
                          targetMember?.username}
                      </p>

                      <p
                        className="
                          mt-0.5
                          text-xs
                          text-gray-500
                          dark:text-gray-400
                        "
                      >
                        @
                        {
                          targetMember?.username
                        }
                      </p>

                    </div>

                  </div>

                </div>

                <p
                  className="
                    mt-4
                    text-sm
                    leading-6
                    text-gray-600
                    dark:text-gray-300
                  "
                >
                  This will remove the member from
                  this trip. They will no longer be
                  able to access this trip or its
                  expenses.
                </p>

                <label
                  htmlFor="confirm-remove-member"
                  className="
                    mt-5
                    block
                    text-xs
                    font-semibold
                    text-gray-600
                    dark:text-gray-300
                  "
                >
                  Type{' '}
                  <span className="font-bold text-gray-900 dark:text-white">
                    {targetMember?.username}
                  </span>{' '}
                  to confirm
                </label>

                <input
                  id="confirm-remove-member"
                  value={confirmText}
                  onChange={(event) =>
                    setConfirmText(
                      event.target.value
                    )
                  }
                  className="
                    mt-2
                    w-full
                    rounded-xl
                    border
                    border-gray-200
                    bg-white
                    px-3.5
                    py-2.5
                    text-sm
                    text-gray-900
                    outline-none
                    transition
                    focus:border-primary-500
                    focus:ring-2
                    focus:ring-primary-500/20
                    dark:border-gray-700
                    dark:bg-gray-800
                    dark:text-white
                  "
                  placeholder={
                    targetMember?.username ||
                    'username'
                  }
                  autoComplete="off"
                />

                <div className="mt-5 grid grid-cols-2 gap-2">

                  <button
                    type="button"
                    onClick={
                      closeConfirm
                    }
                    disabled={
                      Boolean(removing)
                    }
                    className="
                      rounded-xl
                      border
                      border-gray-200
                      bg-white
                      px-4
                      py-2.5
                      text-sm
                      font-semibold
                      text-gray-700
                      transition
                      hover:bg-gray-50
                      disabled:opacity-40
                      dark:border-gray-700
                      dark:bg-gray-800
                      dark:text-gray-200
                      dark:hover:bg-gray-700
                    "
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      confirmAndRemove
                    }
                    disabled={
                      Boolean(removing) ||
                      confirmText !==
                        (
                          targetMember?.username ||
                          ''
                        )
                    }
                    className="
                      inline-flex
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      bg-red-600
                      px-4
                      py-2.5
                      text-sm
                      font-semibold
                      text-white
                      transition
                      hover:bg-red-700
                      disabled:cursor-not-allowed
                      disabled:opacity-40
                    "
                  >
                    {removing ? (
                      <>
                        <span
                          className="
                            h-3.5
                            w-3.5
                            animate-spin
                            rounded-full
                            border-2
                            border-white/40
                            border-t-white
                          "
                        />

                        Removing…
                      </>
                    ) : (
                      <>
                        <FaTrash className="h-3 w-3" />
                        Remove
                      </>
                    )}
                  </button>

                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================
          SETTLEMENT ERROR MODAL
      ====================================================== */}

      <AnimatePresence>
        {settlementError && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="
              fixed
              inset-0
              z-[110]
              flex
              items-center
              justify-center
              overflow-y-auto
              bg-black/50
              p-4
              backdrop-blur-sm
            "
            onMouseDown={() =>
              setSettlementError(null)
            }
          >

            <motion.div
              initial={{
                opacity: 0,
                scale: 0.96,
                y: 10,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
                y: 10,
              }}
              onMouseDown={(event) =>
                event.stopPropagation()
              }
              className="
                my-auto
                w-full
                max-w-lg
                overflow-hidden
                rounded-2xl
                border
                border-gray-200
                bg-white
                shadow-2xl
                dark:border-gray-700
                dark:bg-gray-900
              "
            >

              {/* HEADER */}

              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-4
                  border-b
                  border-gray-100
                  p-5
                  dark:border-gray-800
                "
              >

                <div className="flex items-center gap-3">

                  <IconBox
                    size="h-11 w-11"
                  >
                    <FaBalanceScale className="h-5 w-5" />
                  </IconBox>

                  <div>

                    <h3
                      className="
                        text-base
                        font-bold
                        text-gray-900
                        dark:text-white
                      "
                    >
                      Cannot remove member
                    </h3>

                    <p
                      className="
                        mt-0.5
                        text-xs
                        text-gray-500
                        dark:text-gray-400
                      "
                    >
                      Pending settlement detected
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSettlementError(
                      null
                    )
                  }
                  className="
                    flex
                    h-8
                    w-8
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    text-gray-400
                    transition
                    hover:bg-gray-100
                    hover:text-gray-600
                    dark:hover:bg-gray-800
                  "
                  aria-label="Close"
                >
                  <FaTimes className="h-3.5 w-3.5" />
                </button>

              </div>

              {/* BODY */}

              <div className="space-y-4 p-5">

                {/* MESSAGE */}

                <div
                  className="
                    rounded-xl
                    border
                    border-primary-100
                    bg-primary-50
                    p-4
                    dark:border-primary-900/50
                    dark:bg-primary-950/30
                  "
                >

                  <p
                    className="
                      text-sm
                      font-semibold
                      text-primary-900
                      dark:text-primary-200
                    "
                  >
                    @
                    {
                      settlementError
                        .member?.username
                    }{' '}
                    has active settlements in this
                    trip.
                  </p>

                  <p
                    className="
                      mt-2
                      text-sm
                      leading-6
                      text-primary-800
                      dark:text-primary-300
                    "
                  >
                    {settlementError.message}
                  </p>

                </div>

                {/* SETTLEMENT DETAILS */}

                {settlementError.details && (
                  <div
                    className="
                      rounded-xl
                      border
                      border-gray-200
                      bg-gray-50
                      p-4
                      dark:border-gray-700
                      dark:bg-gray-800
                    "
                  >

                    <p
                      className="
                        mb-3
                        text-xs
                        font-bold
                        uppercase
                        tracking-wide
                        text-gray-500
                        dark:text-gray-400
                      "
                    >
                      Settlement details
                    </p>

                    {/* BALANCE */}

                    {settlementError
                      .details
                      .balance !==
                      undefined && (
                      <div
                        className="
                          flex
                          items-center
                          justify-between
                          gap-3
                          border-b
                          border-gray-200
                          py-2
                          dark:border-gray-700
                        "
                      >

                        <span
                          className="
                            text-xs
                            font-medium
                            text-gray-500
                            dark:text-gray-400
                          "
                        >
                          Balance
                        </span>

                        <span
                          className="
                            text-sm
                            font-bold
                            text-gray-900
                            dark:text-white
                          "
                        >
                          ₹
                          {Math.abs(
                            Number(
                              settlementError
                                .details
                                .balance ||
                                0
                            )
                          ).toFixed(2)}
                        </span>

                      </div>
                    )}

                    {/* OWES */}

                    {settlementError
                      .details
                      .owes && (
                      <div
                        className="
                          flex
                          flex-col
                          gap-1
                          border-b
                          border-gray-200
                          py-2
                          dark:border-gray-700
                        "
                      >

                        <span
                          className="
                            text-xs
                            font-medium
                            text-gray-500
                            dark:text-gray-400
                          "
                        >
                          Owes to
                        </span>

                        <span
                          className="
                            text-sm
                            font-semibold
                            text-gray-800
                            dark:text-gray-200
                          "
                        >
                          {
                            settlementError
                              .details
                              .owes
                          }
                        </span>

                      </div>
                    )}

                    {/* OWED BY */}

                    {settlementError
                      .details
                      .owedBy && (
                      <div
                        className="
                          flex
                          flex-col
                          gap-1
                          border-b
                          border-gray-200
                          py-2
                          dark:border-gray-700
                        "
                      >

                        <span
                          className="
                            text-xs
                            font-medium
                            text-gray-500
                            dark:text-gray-400
                          "
                        >
                          Owed by
                        </span>

                        <span
                          className="
                            text-sm
                            font-semibold
                            text-gray-800
                            dark:text-gray-200
                          "
                        >
                          {
                            settlementError
                              .details
                              .owedBy
                          }
                        </span>

                      </div>
                    )}

                    {/* COUNT */}

                    {settlementError
                      .details
                      .settlementCount >
                      0 && (
                      <div
                        className="
                          flex
                          items-center
                          justify-between
                          gap-3
                          pt-2
                        "
                      >

                        <span
                          className="
                            text-xs
                            font-medium
                            text-gray-500
                            dark:text-gray-400
                          "
                        >
                          Active transactions
                        </span>

                        <span
                          className="
                            text-sm
                            font-bold
                            text-gray-900
                            dark:text-white
                          "
                        >
                          {
                            settlementError
                              .details
                              .settlementCount
                          }
                        </span>

                      </div>
                    )}

                  </div>
                )}

                {/* INFORMATION */}

                <div
                  className="
                    flex
                    items-start
                    gap-3
                    rounded-xl
                    border
                    border-gray-200
                    bg-gray-50
                    p-3.5
                    dark:border-gray-700
                    dark:bg-gray-800
                  "
                >

                  <FaBalanceScale
                    className="
                      mt-0.5
                      shrink-0
                      text-primary-600
                      dark:text-primary-400
                    "
                  />

                  <p
                    className="
                      text-xs
                      leading-5
                      text-gray-600
                      dark:text-gray-300
                    "
                  >
                    All balances for this member
                    must be settled before they can
                    be removed from the trip.
                  </p>

                </div>

                {/* CLOSE */}

                <button
                  type="button"
                  onClick={() =>
                    setSettlementError(
                      null
                    )
                  }
                  className="
                    w-full
                    rounded-xl
                    bg-primary-600
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-primary-700
                    focus:outline-none
                    focus:ring-2
                    focus:ring-primary-500/30
                  "
                >
                  Understood
                </button>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default MembersTab;