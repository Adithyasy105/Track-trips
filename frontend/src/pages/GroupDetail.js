// src/pages/GroupDetail.js

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

import {
  useParams,
  useNavigate,
} from 'react-router-dom';

import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

import {
  FaArrowLeft,
  FaPlus,
  FaUsers,
  FaMapMarkerAlt,
  FaTrash,
} from 'react-icons/fa';

import {
  groupsAPI,
  tripsAPI,
} from '../services/api';

import { useAuth } from '../context/AuthContext';

import QRCode from 'react-qr-code';

import { CreateTripModal } from '../components/CreateTripModal';
import { JoinGroupModal } from '../components/JoinGroupModal';


/* ============================================================
   ANIMATIONS
============================================================ */

const fadeInUp = {
  hidden: {
    opacity: 0,
    y: 12,
  },

  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
    },
  },
};

const fadeIn = {
  hidden: {
    opacity: 0,
  },

  show: {
    opacity: 1,
    transition: {
      duration: 0.25,
    },
  },
};


/* ============================================================
   MAIN COMPONENT
============================================================ */

export const GroupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  /* ----------------------------------------------------------
     STATE
  ---------------------------------------------------------- */

  const [group, setGroup] = useState(null);
  const [trips, setTrips] = useState([]);
  const [members, setMembers] = useState([]);

  const [loading, setLoading] = useState(true);

  const [showTripModal, setShowTripModal] =
    useState(false);

  const [showJoinModal, setShowJoinModal] =
    useState(false);

  const [isMember, setIsMember] =
    useState(false);

  const [copyingInvite, setCopyingInvite] =
    useState(false);

  const [nickname, setNickname] =
    useState('');

  const [deleting, setDeleting] =
    useState(false);

  const [confirmOpen, setConfirmOpen] =
    useState(false);

  const [confirmValue, setConfirmValue] =
    useState('');

  const [copyingId, setCopyingId] =
    useState(false);

  const [pwOpen, setPwOpen] =
    useState(false);

  const [pwValue, setPwValue] =
    useState('');

  const [pwLoading, setPwLoading] =
    useState(false);

  const [memberConfirmOpen, setMemberConfirmOpen] =
    useState(false);

  const [memberTarget, setMemberTarget] =
    useState(null);

  const [memberConfirmText, setMemberConfirmText] =
    useState('');

  const [removingMember, setRemovingMember] =
    useState(null);

  const [settlementError, setSettlementError] =
    useState(null);


  /* ==========================================================
     LOAD GROUP
  ========================================================== */

  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);

      const groupRes =
        await groupsAPI.getById(id);

      setGroup(groupRes.data);

      setIsMember(
        groupRes.data.is_member
      );

      if (groupRes.data.is_member) {
        const [
          tripsRes,
          membersRes,
        ] = await Promise.all([
          tripsAPI
            .getGroupTrips(id)
            .catch(() => ({ data: [] })),

          groupsAPI
            .getMembers(id)
            .catch(() => ({ data: [] })),
        ]);

        setTrips(
          tripsRes.data || []
        );

        setMembers(
          membersRes.data || []
        );
      } else {
        setShowJoinModal(true);
      }
    } catch (error) {
      console.error(
        'Failed to load group:',
        error
      );

      toast.error(
        'Failed to load group data'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);


  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);


  /* ==========================================================
     JOIN / TRIP SUCCESS
  ========================================================== */

  const handleJoinSuccess = () => {
    setShowJoinModal(false);
    loadGroupData();
  };


  const handleTripCreated = () => {
    setShowTripModal(false);
    loadGroupData();
  };


  /* ==========================================================
     DELETE GROUP
  ========================================================== */

  const handleDeleteGroup = async () => {
    if (!group) return;

    if (confirmValue !== group.name) {
      return;
    }

    try {
      setDeleting(true);

      await groupsAPI.delete(id);

      toast.success(
        'Group deleted'
      );

      navigate('/dashboard');
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
        'Failed to delete group'
      );
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setConfirmValue('');
    }
  };


  /* ==========================================================
     INVITE
  ========================================================== */

  const buildInviteUrl = (token) => {
    const url = new URL(
      `${window.location.origin}/invite/${token}`
    );

    if (nickname) {
      url.searchParams.set(
        'nickname',
        nickname
      );
    }

    return url.toString();
  };


  const handleCopyInvite = async () => {
    try {
      setCopyingInvite(true);

      const response =
        await groupsAPI.createInvite(id);

      const token =
        response.data.token;

      const inviteUrl =
        buildInviteUrl(token);

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(
          inviteUrl
        );
      } else {
        // Fallback for older browsers or non-HTTPS contexts
        const textArea = document.createElement('textarea');
        textArea.value = inviteUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      toast.success(
        'Invite link copied to clipboard'
      );
    } catch (error) {
      console.error('Copy error:', error);
      toast.error(
        error.response?.data?.error ||
        'Failed to copy invite link'
      );
    } finally {
      setCopyingInvite(false);
    }
  };


  /* ==========================================================
     COPY GROUP ID
  ========================================================== */

  const handleCopyGroupId = async () => {
    try {
      setCopyingId(true);

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        // Fallback for older browsers or non-HTTPS contexts
        const textArea = document.createElement('textarea');
        textArea.value = id;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      toast.success(
        'Group ID copied'
      );
    } catch (error) {
      console.error('Copy error:', error);
      toast.error(
        'Failed to copy Group ID'
      );
    } finally {
      setCopyingId(false);
    }
  };


  /* ==========================================================
     MEMBER MANAGEMENT
  ========================================================== */

  const isGroupCreator =
    user &&
    group &&
    user.username === group.created_by;


  const openMemberConfirm = (member) => {
    setMemberTarget(member);
    setMemberConfirmText('');
    setMemberConfirmOpen(true);
  };


  const handleRemoveMember = async () => {
    if (!memberTarget) return;

    try {
      setRemovingMember(
        memberTarget.username
      );

      await groupsAPI.removeMember(
        id,
        memberTarget.username
      );

      toast.success(
        'Member removed and related trips deleted'
      );

      setMemberConfirmOpen(false);
      setMemberTarget(null);
      setMemberConfirmText('');

      await loadGroupData();
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || '';

      if (
        error.response?.data?.settlements ||
        errorMessage
          .toLowerCase()
          .includes('settlement')
      ) {
        setSettlementError({
          member: memberTarget,
          message:
            errorMessage ||
            'Member has pending settlements',
          details:
            error.response?.data?.settlements,
        });

        setMemberConfirmOpen(false);
      } else {
        toast.error(
          errorMessage ||
          'Failed to remove member'
        );
      }
    } finally {
      setRemovingMember(null);
    }
  };


  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="
          flex items-center gap-3
          rounded-2xl
          border border-slate-200
          bg-white
          px-5 py-4
          shadow-sm
          dark:border-slate-700
          dark:bg-slate-900
        ">
          <div className="
            h-5 w-5
            animate-spin
            rounded-full
            border-2
            border-sky-500
            border-t-transparent
          " />

          <span className="
            text-sm
            font-medium
            text-slate-600
            dark:text-slate-300
          ">
            Loading group…
          </span>
        </div>
      </div>
    );
  }


  /* ==========================================================
     NOT FOUND
  ========================================================== */

  if (!group && !showJoinModal) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="
          rounded-3xl
          border border-slate-200
          bg-white
          p-8
          text-center
          shadow-sm
          dark:border-slate-700
          dark:bg-slate-900
        ">
          <div className="
            mx-auto mb-4
            flex h-14 w-14
            items-center justify-center
            rounded-2xl
            bg-slate-100
            text-slate-500
            dark:bg-slate-800
            dark:text-slate-400
          ">
            <FaUsers className="h-6 w-6" />
          </div>

          <p className="
            text-sm
            text-slate-600
            dark:text-slate-400
          ">
            Group not found or you don't have access.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate('/dashboard')
            }
            className="
              mt-5
              inline-flex
              items-center
              gap-2
              rounded-xl
              bg-slate-900
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              transition
              hover:bg-slate-700
              dark:bg-white
              dark:text-slate-900
              dark:hover:bg-slate-200
            "
          >
            <FaArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }


  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <div className="
      min-h-full
      bg-slate-50/70
      pb-12
      dark:bg-slate-950
    ">
      <div className="
        mx-auto
        w-full
        max-w-7xl
        px-3
        py-4
        sm:px-5
        lg:px-8
        lg:py-6
      ">

        {/* ====================================================
            BACK BUTTON
        ==================================================== */}

        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="show"
          className="mb-4"
        >
          <button
            type="button"
            onClick={() =>
              navigate('/dashboard')
            }
            className="
              group
              inline-flex
              items-center
              gap-2
              rounded-lg
              px-1 py-1
              text-sm
              font-medium
              text-slate-500
              transition
              hover:text-slate-900
              dark:text-slate-400
              dark:hover:text-white
            "
          >
            <FaArrowLeft className="
              h-3 w-3
              transition-transform
              group-hover:-translate-x-0.5
            " />

            Dashboard
          </button>
        </motion.div>


        {group && (
          <>

            {/* ==================================================
                GROUP HERO
            ================================================== */}

            <motion.section
              variants={fadeInUp}
              initial="hidden"
              animate="show"
              className="
                relative
                overflow-hidden
                rounded-[28px]
                border border-slate-200/80
                bg-white
                shadow-[0_18px_55px_-35px_rgba(15,23,42,0.35)]
                dark:border-slate-800
                dark:bg-slate-900
              "
            >

              {/* Background decoration */}

              <div className="
                pointer-events-none
                absolute
                inset-0
                bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.15),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.10),_transparent_35%)]
              " />


              <div className="
                relative
                p-4
                sm:p-6
                lg:p-7
              ">

                <div className="
                  flex
                  flex-col
                  gap-6
                  lg:flex-row
                  lg:items-start
                  lg:justify-between
                ">

                  {/* GROUP INFORMATION */}

                  <div className="min-w-0">

                    <div className="
                      mb-3
                      flex
                      flex-wrap
                      items-center
                      gap-2
                    ">

                      <span className="
                        inline-flex
                        items-center
                        gap-1.5
                        rounded-full
                        border
                        border-sky-200
                        bg-sky-50
                        px-2.5
                        py-1
                        text-[11px]
                        font-bold
                        uppercase
                        tracking-wide
                        text-sky-700
                        dark:border-sky-900
                        dark:bg-sky-950/50
                        dark:text-sky-300
                      ">
                        <FaUsers className="h-2.5 w-2.5" />
                        Group
                      </span>


                      {group.has_password && (
                        <span className="
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          border
                          border-amber-200
                          bg-amber-50
                          px-2.5
                          py-1
                          text-[11px]
                          font-semibold
                          text-amber-700
                          dark:border-amber-900
                          dark:bg-amber-950/40
                          dark:text-amber-300
                        ">
                          <span className="
                            h-1.5 w-1.5
                            rounded-full
                            bg-amber-500
                          " />

                          Password protected
                        </span>
                      )}

                    </div>


                    <h1 className="
                      max-w-3xl
                      break-words
                      text-2xl
                      font-bold
                      tracking-tight
                      text-slate-950
                      sm:text-3xl
                      lg:text-4xl
                      dark:text-white
                    ">
                      {group.name}
                    </h1>


                    <p className="
                      mt-2
                      text-sm
                      text-slate-500
                      dark:text-slate-400
                    ">
                      Created by{' '}
                      <span className="
                        font-semibold
                        text-slate-700
                        dark:text-slate-200
                      ">
                        @{group.created_by}
                      </span>
                    </p>


                    {/* STATS */}

                    <div className="
                      mt-5
                      flex
                      flex-wrap
                      gap-2
                    ">

                      <div className="
                        rounded-2xl
                        border border-slate-200
                        bg-white/80
                        px-3 py-2
                        dark:border-slate-700
                        dark:bg-slate-800/70
                      ">
                        <p className="
                          text-[10px]
                          font-semibold
                          uppercase
                          tracking-wider
                          text-slate-400
                        ">
                          Members
                        </p>

                        <p className="
                          mt-0.5
                          text-sm
                          font-bold
                          text-slate-900
                          dark:text-white
                        ">
                          {members.length}
                        </p>
                      </div>


                      <div className="
                        rounded-2xl
                        border border-slate-200
                        bg-white/80
                        px-3 py-2
                        dark:border-slate-700
                        dark:bg-slate-800/70
                      ">
                        <p className="
                          text-[10px]
                          font-semibold
                          uppercase
                          tracking-wider
                          text-slate-400
                        ">
                          Trips
                        </p>

                        <p className="
                          mt-0.5
                          text-sm
                          font-bold
                          text-slate-900
                          dark:text-white
                        ">
                          {trips.length}
                        </p>
                      </div>


                      <div className="
                        rounded-2xl
                        border border-slate-200
                        bg-white/80
                        px-3 py-2
                        dark:border-slate-700
                        dark:bg-slate-800/70
                      ">
                        <p className="
                          text-[10px]
                          font-semibold
                          uppercase
                          tracking-wider
                          text-slate-400
                        ">
                          Group ID
                        </p>

                        <p className="
                          mt-0.5
                          max-w-[180px]
                          truncate
                          font-mono
                          text-xs
                          font-semibold
                          text-slate-700
                          dark:text-slate-300
                        ">
                          {id}
                        </p>
                      </div>

                    </div>

                  </div>


                  {/* ACTIONS */}

                  {isMember && (
                    <div className="
                      flex
                      w-full
                      flex-col
                      gap-2
                      sm:flex-row
                      lg:w-auto
                      lg:shrink-0
                    ">

                      <motion.button
                        type="button"
                        onClick={() =>
                          setShowTripModal(true)
                        }
                        whileHover={{
                          y: -1,
                        }}
                        whileTap={{
                          scale: 0.98,
                        }}
                        className="
                          inline-flex
                          min-h-11
                          flex-1
                          items-center
                          justify-center
                          gap-2
                          rounded-xl
                          bg-sky-600
                          px-4
                          text-sm
                          font-semibold
                          text-white
                          shadow-sm
                          shadow-sky-600/20
                          transition
                          hover:bg-sky-700
                          sm:flex-none
                        "
                      >
                        <FaPlus className="h-3.5 w-3.5" />
                        New Trip
                      </motion.button>


                      {user &&
                        group.created_by ===
                          user.username && (
                          <motion.button
                            type="button"
                            onClick={() =>
                              setConfirmOpen(true)
                            }
                            whileHover={{
                              y: -1,
                            }}
                            whileTap={{
                              scale: 0.98,
                            }}
                            className="
                              inline-flex
                              min-h-11
                              flex-1
                              items-center
                              justify-center
                              gap-2
                              rounded-xl
                              border
                              border-rose-200
                              bg-white
                              px-4
                              text-sm
                              font-semibold
                              text-rose-600
                              transition
                              hover:bg-rose-50
                              sm:flex-none
                              dark:border-rose-900
                              dark:bg-slate-900
                              dark:text-rose-400
                              dark:hover:bg-rose-950/30
                            "
                          >
                            <FaTrash className="h-3.5 w-3.5" />
                            Delete Group
                          </motion.button>
                        )}

                    </div>
                  )}

                </div>


                {/* ==================================================
                    ADMIN CONTROLS
                ================================================== */}

                {user &&
                  group.created_by ===
                    user.username && (
                    <div className="
                      mt-6
                      grid
                      gap-3
                      border-t
                      border-slate-200/80
                      pt-5
                      lg:grid-cols-2
                      dark:border-slate-800
                    ">

                      {/* GROUP ID */}

                      <div className="
                        rounded-2xl
                        border border-slate-200
                        bg-slate-50/80
                        p-3
                        dark:border-slate-800
                        dark:bg-slate-950/40
                      ">
                        <div className="
                          flex
                          flex-col
                          gap-2
                          sm:flex-row
                          sm:items-center
                          sm:justify-between
                        ">

                          <div className="min-w-0">
                            <p className="
                              text-[10px]
                              font-bold
                              uppercase
                              tracking-wider
                              text-slate-400
                            ">
                              Group ID
                            </p>

                            <code className="
                              mt-1
                              block
                              truncate
                              font-mono
                              text-xs
                              text-slate-700
                              dark:text-slate-300
                            ">
                              {id}
                            </code>
                          </div>


                          <button
                            type="button"
                            onClick={handleCopyGroupId}
                            className="
                              shrink-0
                              rounded-lg
                              border
                              border-slate-200
                              bg-white
                              px-3
                              py-2
                              text-xs
                              font-semibold
                              text-slate-700
                              transition
                              hover:bg-slate-100
                              dark:border-slate-700
                              dark:bg-slate-800
                              dark:text-slate-200
                              dark:hover:bg-slate-700
                            "
                          >
                            {copyingId
                              ? 'Copying…'
                              : 'Copy ID'}
                          </button>

                        </div>
                      </div>


                      {/* PASSWORD */}

                      <div className="
                        rounded-2xl
                        border border-slate-200
                        bg-slate-50/80
                        p-3
                        dark:border-slate-800
                        dark:bg-slate-950/40
                      ">
                        <div className="
                          flex
                          flex-col
                          gap-2
                          sm:flex-row
                          sm:items-center
                          sm:justify-between
                        ">

                          <div>
                            <p className="
                              text-[10px]
                              font-bold
                              uppercase
                              tracking-wider
                              text-slate-400
                            ">
                              Group password
                            </p>

                            <p className="
                              mt-1
                              text-xs
                              font-medium
                              text-slate-600
                              dark:text-slate-300
                            ">
                              {group.has_password
                                ? 'Password is currently enabled'
                                : 'No password protection'}
                            </p>
                          </div>


                          <button
                            type="button"
                            onClick={() =>
                              setPwOpen(true)
                            }
                            className="
                              shrink-0
                              rounded-lg
                              border
                              border-slate-200
                              bg-white
                              px-3
                              py-2
                              text-xs
                              font-semibold
                              text-slate-700
                              transition
                              hover:bg-slate-100
                              dark:border-slate-700
                              dark:bg-slate-800
                              dark:text-slate-200
                              dark:hover:bg-slate-700
                            "
                          >
                            {group.has_password
                              ? 'Change Password'
                              : 'Set Password'}
                          </button>

                        </div>
                      </div>

                    </div>
                  )}


                {/* ==================================================
                    INVITE
                ================================================== */}

                {isMember && (
                  <motion.div
                    variants={fadeIn}
                    initial="hidden"
                    animate="show"
                    className="
                      mt-5
                      rounded-2xl
                      border
                      border-sky-200/80
                      bg-sky-50/70
                      p-3.5
                      dark:border-sky-900
                      dark:bg-sky-950/20
                    "
                  >

                    <div className="mb-2">
                      <p className="
                        text-sm
                        font-bold
                        text-slate-900
                        dark:text-white
                      ">
                        Invite people
                      </p>

                      <p className="
                        text-xs
                        text-slate-500
                        dark:text-slate-400
                      ">
                        Create a personalized invite link for your group.
                      </p>
                    </div>


                    <div className="
                      flex
                      flex-col
                      gap-2
                      sm:flex-row
                    ">

                      <input
                        type="text"
                        value={nickname}
                        onChange={(e) =>
                          setNickname(
                            e.target.value
                          )
                        }
                        placeholder="Nickname (optional)"
                        className="
                          min-h-10
                          min-w-0
                          flex-1
                          rounded-xl
                          border
                          border-sky-200
                          bg-white
                          px-3
                          text-sm
                          text-slate-800
                          outline-none
                          transition
                          focus:border-sky-500
                          focus:ring-2
                          focus:ring-sky-500/20
                          dark:border-slate-700
                          dark:bg-slate-900
                          dark:text-white
                        "
                      />


                      <button
                        type="button"
                        onClick={handleCopyInvite}
                        disabled={copyingInvite}
                        className="
                          min-h-10
                          rounded-xl
                          bg-slate-900
                          px-4
                          text-sm
                          font-semibold
                          text-white
                          transition
                          hover:bg-slate-700
                          disabled:cursor-not-allowed
                          disabled:opacity-50
                          dark:bg-white
                          dark:text-slate-900
                          dark:hover:bg-slate-200
                        "
                      >
                        {copyingInvite
                          ? 'Creating…'
                          : 'Copy Invite Link'}
                      </button>

                    </div>
                  </motion.div>
                )}

              </div>
            </motion.section>


            {/* ====================================================
                MEMBERS + QR
            ==================================================== */}

            <div className="
              mt-6
              grid
              gap-6
              xl:grid-cols-[minmax(0,1fr)_320px]
            ">

              {/* MEMBERS */}

              <section className="
                min-w-0
                rounded-[24px]
                border
                border-slate-200/80
                bg-white
                p-4
                shadow-[0_15px_45px_-35px_rgba(15,23,42,0.35)]
                sm:p-5
                dark:border-slate-800
                dark:bg-slate-900
              ">

                <div className="
                  mb-4
                  flex
                  items-end
                  justify-between
                  gap-3
                ">

                  <div>
                    <p className="
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-[0.18em]
                      text-sky-600
                      dark:text-sky-400
                    ">
                      People
                    </p>

                    <h2 className="
                      mt-1
                      text-xl
                      font-bold
                      tracking-tight
                      text-slate-900
                      dark:text-white
                    ">
                      Members
                    </h2>
                  </div>


                  <span className="
                    rounded-full
                    bg-slate-100
                    px-2.5
                    py-1
                    text-xs
                    font-bold
                    text-slate-600
                    dark:bg-slate-800
                    dark:text-slate-300
                  ">
                    {members.length}
                  </span>

                </div>


                {members.length === 0 ? (
                  <div className="
                    rounded-2xl
                    border
                    border-dashed
                    border-slate-300
                    bg-slate-50
                    px-5
                    py-10
                    text-center
                    dark:border-slate-700
                    dark:bg-slate-950/50
                  ">
                    <FaUsers className="
                      mx-auto
                      mb-3
                      h-7
                      w-7
                      text-slate-400
                    " />

                    <p className="
                      text-sm
                      text-slate-500
                      dark:text-slate-400
                    ">
                      No members found.
                    </p>
                  </div>
                ) : (
                  <div className="
                    grid
                    grid-cols-1
                    gap-2.5
                    sm:grid-cols-2
                  ">

                    {members.map(
                      (member, index) => (
                        <motion.div
                          key={member.username}
                          variants={fadeInUp}
                          initial="hidden"
                          animate="show"
                          transition={{
                            delay:
                              Math.min(
                                index * 0.025,
                                0.15
                              ),
                          }}
                          whileHover={{
                            y: -2,
                          }}
                          className="
                            group
                            flex
                            min-w-0
                            items-center
                            gap-3
                            rounded-2xl
                            border
                            border-slate-200
                            bg-slate-50/60
                            p-3
                            transition
                            hover:border-sky-200
                            hover:bg-sky-50/40
                            dark:border-slate-800
                            dark:bg-slate-950/30
                            dark:hover:border-sky-900
                            dark:hover:bg-sky-950/20
                          "
                        >

                          <div className="
                            flex
                            h-10
                            w-10
                            shrink-0
                            items-center
                            justify-center
                            rounded-xl
                            bg-gradient-to-br
                            from-sky-500
                            to-indigo-500
                            text-sm
                            font-bold
                            text-white
                            shadow-sm
                          ">
                            {(
                              member.full_name ||
                              member.username
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>


                          <div className="
                            min-w-0
                            flex-1
                          ">
                            <p className="
                              truncate
                              text-sm
                              font-bold
                              text-slate-900
                              dark:text-white
                            ">
                              {member.full_name ||
                                member.username}
                            </p>

                            <p className="
                              truncate
                              text-xs
                              text-slate-500
                              dark:text-slate-400
                            ">
                              @{member.username}
                            </p>
                          </div>


                          {isGroupCreator &&
                            member.username !==
                              group.created_by && (
                              <button
                                type="button"
                                onClick={() =>
                                  openMemberConfirm(
                                    member
                                  )
                                }
                                disabled={
                                  removingMember ===
                                  member.username
                                }
                                className="
                                  flex
                                  h-8
                                  w-8
                                  shrink-0
                                  items-center
                                  justify-center
                                  rounded-lg
                                  text-slate-400
                                  transition
                                  hover:bg-rose-100
                                  hover:text-rose-600
                                  disabled:opacity-40
                                  dark:hover:bg-rose-950/40
                                "
                                title="Remove member"
                                aria-label="Remove member"
                              >
                                <FaTrash className="h-3.5 w-3.5" />
                              </button>
                            )}

                        </motion.div>
                      )
                    )}

                  </div>
                )}

              </section>


              {/* ==================================================
                  QR INVITE
              ================================================== */}

              {isMember && (
                <section className="
                  rounded-[24px]
                  border
                  border-slate-200/80
                  bg-white
                  p-4
                  shadow-[0_15px_45px_-35px_rgba(15,23,42,0.35)]
                  sm:p-5
                  dark:border-slate-800
                  dark:bg-slate-900
                ">

                  <p className="
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-[0.18em]
                    text-sky-600
                    dark:text-sky-400
                  ">
                    Quick invite
                  </p>

                  <h2 className="
                    mt-1
                    text-xl
                    font-bold
                    tracking-tight
                    text-slate-900
                    dark:text-white
                  ">
                    Invite via QR
                  </h2>

                  <p className="
                    mt-1
                    text-xs
                    leading-5
                    text-slate-500
                    dark:text-slate-400
                  ">
                    Scan this code to join the group quickly.
                  </p>


                  <div className="
                    mt-5
                    flex
                    justify-center
                    rounded-2xl
                    border
                    border-slate-200
                    bg-slate-50
                    p-4
                    dark:border-slate-800
                    dark:bg-slate-950/50
                  ">
                    <LiveInviteQR
                      groupId={id}
                      nickname={nickname}
                    />
                  </div>

                </section>
              )}

            </div>


            {/* ====================================================
                TRIPS
            ==================================================== */}

            <section className="mt-6">

              <div className="
                mb-4
                flex
                flex-col
                gap-3
                sm:flex-row
                sm:items-end
                sm:justify-between
              ">

                <div>
                  <p className="
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-[0.18em]
                    text-sky-600
                    dark:text-sky-400
                  ">
                    Your journeys
                  </p>

                  <h2 className="
                    mt-1
                    text-xl
                    font-bold
                    tracking-tight
                    text-slate-900
                    dark:text-white
                  ">
                    Trips
                  </h2>

                  <p className="
                    mt-1
                    text-sm
                    text-slate-500
                    dark:text-slate-400
                  ">
                    {trips.length
                      ? `${trips.length} trip${
                          trips.length === 1
                            ? ''
                            : 's'
                        } in this group`
                      : 'Start your first trip'}
                  </p>
                </div>


                {isMember &&
                  trips.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowTripModal(true)
                      }
                      className="
                        inline-flex
                        min-h-10
                        items-center
                        justify-center
                        gap-2
                        rounded-xl
                        bg-sky-600
                        px-4
                        text-sm
                        font-semibold
                        text-white
                        shadow-sm
                        transition
                        hover:bg-sky-700
                      "
                    >
                      <FaPlus className="h-3.5 w-3.5" />
                      New Trip
                    </button>
                  )}

              </div>


              {/* EMPTY TRIPS */}

              {trips.length === 0 ? (
                <div className="
                  rounded-[24px]
                  border
                  border-dashed
                  border-slate-300
                  bg-white
                  px-6
                  py-14
                  text-center
                  shadow-sm
                  dark:border-slate-700
                  dark:bg-slate-900
                ">

                  <div className="
                    mx-auto
                    mb-4
                    flex
                    h-14
                    w-14
                    items-center
                    justify-center
                    rounded-2xl
                    bg-sky-50
                    text-sky-600
                    dark:bg-sky-950/40
                    dark:text-sky-400
                  ">
                    <FaMapMarkerAlt className="h-6 w-6" />
                  </div>


                  <h3 className="
                    text-base
                    font-bold
                    text-slate-900
                    dark:text-white
                  ">
                    No trips yet
                  </h3>


                  <p className="
                    mx-auto
                    mt-1
                    max-w-sm
                    text-sm
                    text-slate-500
                    dark:text-slate-400
                  ">
                    Create your first trip and start
                    tracking expenses, places, and
                    settlements together.
                  </p>


                  {isMember && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowTripModal(true)
                      }
                      className="
                        mt-5
                        inline-flex
                        items-center
                        gap-2
                        rounded-xl
                        bg-sky-600
                        px-4
                        py-2.5
                        text-sm
                        font-semibold
                        text-white
                        shadow-sm
                        transition
                        hover:bg-sky-700
                      "
                    >
                      <FaPlus className="h-3.5 w-3.5" />
                      Create First Trip
                    </button>
                  )}

                </div>
              ) : (

                /* ==================================================
                   TRIP CARDS
                ================================================== */

                <div className="
                  grid
                  grid-cols-1
                  gap-4
                  md:grid-cols-2
                  xl:grid-cols-3
                ">

                  {trips.map(
                    (trip, index) => (
                      <motion.button
                        type="button"
                        key={trip.id}
                        initial={{
                          opacity: 0,
                          y: 15,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        transition={{
                          delay:
                            Math.min(
                              index * 0.04,
                              0.2
                            ),
                        }}
                        whileHover={{
                          y: -3,
                        }}
                        whileTap={{
                          scale: 0.99,
                        }}
                        onClick={() =>
                          navigate(
                            `/trips/${trip.id}`
                          )
                        }
                        className="
                          group
                          min-w-0
                          overflow-hidden
                          rounded-[24px]
                          border
                          border-slate-200
                          bg-white
                          text-left
                          shadow-[0_12px_35px_-28px_rgba(15,23,42,0.45)]
                          transition
                          hover:border-sky-200
                          hover:shadow-[0_20px_45px_-28px_rgba(14,165,233,0.35)]
                          dark:border-slate-800
                          dark:bg-slate-900
                          dark:hover:border-sky-900
                        "
                      >

                        {/* TOP COLOR BAR */}

                        <div className="
                          h-1.5
                          bg-gradient-to-r
                          from-sky-500
                          via-cyan-500
                          to-indigo-500
                        " />


                        <div className="p-4 sm:p-5">

                          <div className="
                            mb-4
                            flex
                            items-start
                            justify-between
                            gap-3
                          ">

                            <div className="
                              flex
                              h-10
                              w-10
                              shrink-0
                              items-center
                              justify-center
                              rounded-xl
                              bg-sky-50
                              text-sky-600
                              dark:bg-sky-950/40
                              dark:text-sky-400
                            ">
                              <FaMapMarkerAlt className="h-4 w-4" />
                            </div>


                            <span className="
                              rounded-full
                              bg-slate-100
                              px-2.5
                              py-1
                              text-[10px]
                              font-bold
                              uppercase
                              tracking-wide
                              text-slate-500
                              dark:bg-slate-800
                              dark:text-slate-400
                            ">
                              Open trip
                            </span>

                          </div>


                          <h3 className="
                            line-clamp-2
                            text-base
                            font-bold
                            leading-6
                            text-slate-900
                            transition
                            group-hover:text-sky-600
                            dark:text-white
                            dark:group-hover:text-sky-400
                          ">
                            {trip.name}
                          </h3>


                          <p className="
                            mt-1
                            text-xs
                            text-slate-500
                            dark:text-slate-400
                          ">
                            Created by{' '}
                            <span className="font-semibold">
                              @{trip.created_by}
                            </span>
                          </p>


                          <div className="
                            mt-4
                            space-y-2
                            border-t
                            border-slate-100
                            pt-3
                            dark:border-slate-800
                          ">

                            {trip.location && (
                              <div className="
                                flex
                                min-w-0
                                items-center
                                gap-2
                                text-xs
                                text-slate-600
                                dark:text-slate-300
                              ">
                                <FaMapMarkerAlt className="
                                  h-3 w-3
                                  shrink-0
                                  text-sky-500
                                " />

                                <span className="truncate">
                                  {trip.location}
                                </span>
                              </div>
                            )}


                            {trip.start_date && (
                              <p className="
                                text-xs
                                text-slate-400
                                dark:text-slate-500
                              ">
                                Starts{' '}
                                {new Date(
                                  trip.start_date
                                ).toLocaleDateString()}
                              </p>
                            )}

                          </div>


                          <div className="
                            mt-4
                            flex
                            items-center
                            justify-between
                            text-xs
                            font-semibold
                            text-sky-600
                            dark:text-sky-400
                          ">
                            <span>
                              Open trip
                            </span>

                            <span className="
                              transition-transform
                              group-hover:translate-x-1
                            ">
                              →
                            </span>
                          </div>

                        </div>
                      </motion.button>
                    )
                  )}

                </div>
              )}

            </section>

          </>
        )}


        {/* ======================================================
            CREATE TRIP MODAL
        ====================================================== */}

        <CreateTripModal
          isOpen={showTripModal}
          onClose={() =>
            setShowTripModal(false)
          }
          onSuccess={handleTripCreated}
          groups={
            group
              ? [group]
              : []
          }
          selectedGroupId={id}
        />


        {/* ======================================================
            JOIN GROUP MODAL
        ====================================================== */}

        <JoinGroupModal
          isOpen={showJoinModal}
          onClose={() => {
            setShowJoinModal(false);
            navigate('/dashboard');
          }}
          onSuccess={handleJoinSuccess}
          groupId={id}
        />


        {/* ======================================================
            DELETE GROUP MODAL
        ====================================================== */}

        {confirmOpen && (
          <div className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-950/60
            p-4
            backdrop-blur-sm
          ">

            <div className="
              w-full
              max-w-md
              rounded-3xl
              border
              border-slate-200
              bg-white
              p-5
              shadow-2xl
              sm:p-6
              dark:border-slate-700
              dark:bg-slate-900
            ">

              <h3 className="
                text-xl
                font-bold
                text-slate-900
                dark:text-white
              ">
                Delete Group
              </h3>


              <p className="
                mt-2
                text-sm
                leading-6
                text-slate-500
                dark:text-slate-400
              ">
                This action cannot be undone.
                Type the group name exactly to
                confirm.
              </p>


              <p className="
                mt-3
                rounded-xl
                bg-rose-50
                px-3
                py-2
                text-sm
                font-bold
                text-rose-700
                dark:bg-rose-950/30
                dark:text-rose-300
              ">
                {group?.name}
              </p>


              <input
                value={confirmValue}
                onChange={(e) =>
                  setConfirmValue(
                    e.target.value
                  )
                }
                className="input-field mt-3"
                placeholder="Type group name exactly"
              />


              <div className="
                mt-4
                grid
                grid-cols-2
                gap-2
              ">

                <button
                  type="button"
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmValue('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>


                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  disabled={
                    deleting ||
                    confirmValue !==
                      (group?.name || '')
                  }
                  className="
                    rounded-xl
                    bg-rose-600
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-rose-700
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  {deleting
                    ? 'Deleting…'
                    : 'Delete'}
                </button>

              </div>

            </div>
          </div>
        )}


        {/* ======================================================
            PASSWORD MODAL
        ====================================================== */}

        {pwOpen && (
          <div className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-950/60
            p-4
            backdrop-blur-sm
          ">

            <div className="
              w-full
              max-w-md
              rounded-3xl
              border
              border-slate-200
              bg-white
              p-5
              shadow-2xl
              sm:p-6
              dark:border-slate-700
              dark:bg-slate-900
            ">

              <h3 className="
                text-xl
                font-bold
                text-slate-900
                dark:text-white
              ">
                Change Group Password
              </h3>


              <p className="
                mt-2
                text-sm
                leading-6
                text-slate-500
                dark:text-slate-400
              ">
                Leave the field empty to remove
                password protection.
              </p>


              <input
                type="password"
                value={pwValue}
                onChange={(e) =>
                  setPwValue(
                    e.target.value
                  )
                }
                className="input-field mt-4"
                placeholder="New password (min 6) or empty to remove"
              />


              <div className="
                mt-4
                grid
                grid-cols-2
                gap-2
              ">

                <button
                  type="button"
                  onClick={() => {
                    setPwOpen(false);
                    setPwValue('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>


                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setPwLoading(true);

                      await groupsAPI.updatePassword(
                        id,
                        pwValue.trim() === ''
                          ? null
                          : pwValue
                      );

                      toast.success(
                        pwValue.trim() === ''
                          ? 'Password removed'
                          : 'Password updated'
                      );

                      setPwOpen(false);
                      setPwValue('');

                      await loadGroupData();
                    } catch (error) {
                      toast.error(
                        error.response?.data?.error ||
                        'Failed to update password'
                      );
                    } finally {
                      setPwLoading(false);
                    }
                  }}
                  disabled={pwLoading}
                  className="btn-primary"
                >
                  {pwLoading
                    ? 'Saving…'
                    : 'Save'}
                </button>

              </div>

            </div>
          </div>
        )}


        {/* ======================================================
            REMOVE MEMBER MODAL
        ====================================================== */}

        {memberConfirmOpen && (
          <div className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-950/60
            p-4
            backdrop-blur-sm
          ">

            <div className="
              w-full
              max-w-md
              rounded-3xl
              border
              border-slate-200
              bg-white
              p-5
              shadow-2xl
              sm:p-6
              dark:border-slate-700
              dark:bg-slate-900
            ">

              <div className="
                flex
                items-start
                gap-3
              ">

                <div className="
                  flex
                  h-11
                  w-11
                  shrink-0
                  items-center
                  justify-center
                  rounded-2xl
                  bg-rose-50
                  text-rose-600
                  dark:bg-rose-950/40
                  dark:text-rose-400
                ">
                  <FaTrash className="h-4 w-4" />
                </div>


                <div>
                  <h3 className="
                    text-xl
                    font-bold
                    text-slate-900
                    dark:text-white
                  ">
                    Remove Member
                  </h3>

                  <p className="
                    mt-1
                    text-xs
                    text-slate-500
                    dark:text-slate-400
                  ">
                    This action cannot be undone.
                  </p>
                </div>

              </div>


              <p className="
                mt-4
                text-sm
                leading-6
                text-slate-600
                dark:text-slate-300
              ">
                This will remove{' '}
                <span className="font-bold">
                  @{memberTarget?.username}
                </span>{' '}
                and delete all trips they
                created or participated in
                within this group.
              </p>


              <input
                value={memberConfirmText}
                onChange={(e) =>
                  setMemberConfirmText(
                    e.target.value
                  )
                }
                className="input-field mt-4"
                placeholder={
                  memberTarget?.username ||
                  'username'
                }
              />


              <div className="
                mt-4
                grid
                grid-cols-2
                gap-2
              ">

                <button
                  type="button"
                  onClick={() => {
                    setMemberConfirmOpen(false);
                    setMemberTarget(null);
                    setMemberConfirmText('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>


                <button
                  type="button"
                  onClick={handleRemoveMember}
                  disabled={
                    removingMember ===
                      memberTarget?.username ||
                    memberConfirmText !==
                      (memberTarget?.username ||
                        '')
                  }
                  className="
                    rounded-xl
                    bg-rose-600
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-rose-700
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  {removingMember ===
                  memberTarget?.username
                    ? 'Removing…'
                    : 'Remove'}
                </button>

              </div>

            </div>
          </div>
        )}


        {/* ======================================================
            SETTLEMENT ERROR MODAL
        ====================================================== */}

        {settlementError && (
          <div className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-950/60
            p-4
            backdrop-blur-sm
          ">

            <div className="
              w-full
              max-w-lg
              rounded-3xl
              border
              border-slate-200
              bg-white
              p-5
              shadow-2xl
              sm:p-6
              dark:border-slate-700
              dark:bg-slate-900
            ">

              <div className="
                flex
                items-start
                gap-3
              ">

                <div className="
                  flex
                  h-12
                  w-12
                  shrink-0
                  items-center
                  justify-center
                  rounded-2xl
                  bg-amber-50
                  text-amber-600
                  dark:bg-amber-950/40
                  dark:text-amber-400
                ">
                  <FaUsers className="text-lg" />
                </div>


                <div>
                  <h3 className="
                    text-xl
                    font-bold
                    text-slate-900
                    dark:text-white
                  ">
                    Cannot Remove Member
                  </h3>

                  <p className="
                    mt-1
                    text-sm
                    text-slate-500
                    dark:text-slate-400
                  ">
                    Pending settlements detected
                  </p>
                </div>

              </div>


              <div className="
                mt-5
                rounded-2xl
                border
                border-amber-200
                bg-amber-50
                p-4
                dark:border-amber-900
                dark:bg-amber-950/20
              ">

                <p className="
                  text-sm
                  font-semibold
                  text-amber-900
                  dark:text-amber-200
                ">
                  @{settlementError.member?.username}
                  {' '}has active settlements.
                </p>

                <p className="
                  mt-2
                  whitespace-pre-line
                  text-sm
                  leading-6
                  text-amber-800
                  dark:text-amber-300
                ">
                  {settlementError.message}
                </p>

              </div>


              {settlementError.details && (
                <div className="
                  mt-3
                  rounded-2xl
                  bg-slate-50
                  p-4
                  dark:bg-slate-800/70
                ">

                  <p className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-500
                    dark:text-slate-400
                  ">
                    Settlement details
                  </p>


                  {settlementError.details.balance !==
                    undefined && (
                    <p className="
                      mt-2
                      text-sm
                      text-slate-600
                      dark:text-slate-300
                    ">
                      <span className="font-semibold">
                        Balance:
                      </span>{' '}

                      {settlementError.details.balance >
                      0 ? (
                        <span className="
                          font-semibold
                          text-emerald-600
                          dark:text-emerald-400
                        ">
                          +₹
                          {Math.abs(
                            settlementError.details.balance
                          ).toFixed(2)}
                          {' '}
                          (owed to them)
                        </span>
                      ) : (
                        <span className="
                          font-semibold
                          text-rose-600
                          dark:text-rose-400
                        ">
                          -₹
                          {Math.abs(
                            settlementError.details.balance
                          ).toFixed(2)}
                          {' '}
                          (they owe)
                        </span>
                      )}
                    </p>
                  )}


                  {settlementError.details.owes && (
                    <p className="
                      mt-1
                      text-sm
                      text-slate-600
                      dark:text-slate-300
                    ">
                      <span className="font-semibold">
                        Owes to:
                      </span>{' '}
                      {settlementError.details.owes}
                    </p>
                  )}


                  {settlementError.details.owedBy && (
                    <p className="
                      mt-1
                      text-sm
                      text-slate-600
                      dark:text-slate-300
                    ">
                      <span className="font-semibold">
                        Owed by:
                      </span>{' '}
                      {settlementError.details.owedBy}
                    </p>
                  )}


                  {settlementError.details.settlementCount >
                    0 && (
                    <p className="
                      mt-1
                      text-sm
                      text-slate-600
                      dark:text-slate-300
                    ">
                      <span className="font-semibold">
                        Active transactions:
                      </span>{' '}
                      {
                        settlementError.details
                          .settlementCount
                      }
                    </p>
                  )}

                </div>
              )}


              <div className="
                mt-4
                rounded-2xl
                border
                border-sky-200
                bg-sky-50
                p-3
                dark:border-sky-900
                dark:bg-sky-950/20
              ">
                <p className="
                  text-xs
                  leading-5
                  text-sky-800
                  dark:text-sky-200
                ">
                  <strong>Note:</strong>{' '}
                  All balances must be settled
                  to ₹0.00 before a member can
                  be removed.
                </p>
              </div>


              <button
                type="button"
                onClick={() =>
                  setSettlementError(null)
                }
                className="
                  btn-primary
                  mt-4
                  w-full
                "
              >
                Understood
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};


/* ============================================================
   LIVE INVITE QR
============================================================ */

const LiveInviteQR = ({
  groupId,
  nickname,
}) => {
  const [url, setUrl] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState(null);

  const qrWrapperRef =
    useRef(null);


  const buildUrl = useCallback(
    (token) => {
      const inviteUrl =
        new URL(
          `${window.location.origin}/invite/${token}`
        );

      if (nickname) {
        inviteUrl.searchParams.set(
          'nickname',
          nickname
        );
      }

      return inviteUrl.toString();
    },
    [nickname]
  );


  const refresh = useCallback(
    async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[QR] Fetching invite for groupId:', groupId);

        const response =
          await groupsAPI.createInvite(
            groupId
          );

        console.log('[QR] Invite response:', response);

        setUrl(
          buildUrl(
            response.data.token
          )
        );
      } catch (error) {
        console.error(
          '[QR] Failed to generate QR:',
          error
        );
        const errorMsg = error.response?.data?.error || error.message || 'Failed to generate invite link';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [
      groupId,
      buildUrl,
    ]
  );


  useEffect(() => {
    refresh();
  }, [groupId, refresh]);


  const downloadQR = () => {
    try {
      const wrapper =
        qrWrapperRef.current;

      if (!wrapper) return;

      const svg =
        wrapper.querySelector(
          'svg'
        );

      if (!svg) return;

      const serializer =
        new XMLSerializer();

      let source =
        serializer.serializeToString(
          svg
        );

      if (
        !source.match(
          /^<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/
        )
      ) {
        source = source.replace(
          '<svg',
          '<svg xmlns="http://www.w3.org/2000/svg"'
        );
      }

      source =
        '<?xml version="1.0" standalone="no"?>\r\n' +
        source;

      const blob =
        new Blob(
          [source],
          {
            type:
              'image/svg+xml;charset=utf-8',
          }
        );

      const urlObject =
        URL.createObjectURL(blob);

      const anchor =
        document.createElement('a');

      anchor.href =
        urlObject;

      anchor.download =
        `group-${groupId}-qr.svg`;

      document.body.appendChild(
        anchor
      );

      anchor.click();

      document.body.removeChild(
        anchor
      );

      URL.revokeObjectURL(
        urlObject
      );
    } catch (error) {
      console.error(
        'Failed to download QR:',
        error
      );

      toast.error(
        'Failed to download QR'
      );
    }
  };


  return (
    <div className="
      flex
      w-full
      flex-col
      items-center
    ">

      {/* QR */}

      {error ? (
        <div className="
          flex
          h-[160px]
          w-[160px]
          flex-col
          items-center
          justify-center
          rounded-2xl
          bg-red-50
          text-xs
          text-red-600
          shadow-sm
          p-3
          text-center
        ">
          <div className="font-semibold mb-2">⚠️ Error</div>
          <div className="text-[10px] mb-2">{error}</div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="text-[10px] underline hover:text-red-700"
          >
            {loading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : url ? (
        <div
          ref={qrWrapperRef}
          className="
            rounded-2xl
            bg-white
            p-3
            shadow-sm
          "
        >
          <QRCode
            value={url}
            size={160}
            fgColor="#0f172a"
            bgColor="#ffffff"
          />
        </div>
      ) : (
        <div className="
          flex
          h-[160px]
          w-[160px]
          items-center
          justify-center
          rounded-2xl
          bg-white
          text-xs
          text-slate-500
          shadow-sm
        ">
          {loading
            ? 'Generating QR…'
            : 'QR unavailable'}
        </div>
      )}


      {/* ACTIONS */}

      <div className="
        mt-4
        flex
        w-full
        flex-col
        gap-2
        sm:flex-row
        sm:justify-center
      ">

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="
            rounded-xl
            border
            border-slate-200
            bg-white
            px-3
            py-2
            text-xs
            font-semibold
            text-slate-700
            transition
            hover:bg-slate-100
            disabled:cursor-not-allowed
            disabled:opacity-50
            dark:border-slate-700
            dark:bg-slate-800
            dark:text-slate-200
            dark:hover:bg-slate-700
          "
        >
          {loading
            ? 'Refreshing…'
            : 'Refresh QR'}
        </button>


        <button
          type="button"
          onClick={downloadQR}
          disabled={!url}
          className="
            rounded-xl
            bg-sky-600
            px-3
            py-2
            text-xs
            font-semibold
            text-white
            transition
            hover:bg-sky-700
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          Download QR
        </button>

      </div>


      {/* URL */}

      {url && (
        <p className="
          mt-3
          max-w-full
          break-all
          text-center
          text-[10px]
          leading-4
          text-slate-400
          dark:text-slate-500
        ">
          {url}
        </p>
      )}

    </div>
  );
};


export default GroupDetail;