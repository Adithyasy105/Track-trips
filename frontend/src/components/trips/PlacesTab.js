// src/components/trips/PlacesTab.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

import {
  FaPlus,
  FaTrash,
  FaMapMarkerAlt,
  FaImage,
  FaCalendarAlt,
  FaUser,
  FaChevronDown,
  FaRoute,
  FaFlag,
  FaUsers,
  FaCamera,
  FaSearch,
  FaTimes,
  FaMapMarkedAlt,
  FaClock,
  FaArrowRight,
} from 'react-icons/fa';

import { placesAPI } from '../../services/api';
import { AddPlaceModal } from './AddPlaceModal';

/* ============================================================
   MARKER / ACCENT STYLES
============================================================ */

const MARKER_STYLES = [
  {
    marker:
      'bg-sky-500 shadow-[0_0_0_5px_rgba(14,165,233,0.12)]',
    soft:
      'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    border:
      'border-sky-200/80 dark:border-sky-800/70',
    accent:
      'from-sky-500 to-cyan-400',
  },
  {
    marker:
      'bg-orange-500 shadow-[0_0_0_5px_rgba(249,115,22,0.12)]',
    soft:
      'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
    border:
      'border-orange-200/80 dark:border-orange-800/70',
    accent:
      'from-orange-500 to-amber-400',
  },
  {
    marker:
      'bg-violet-500 shadow-[0_0_0_5px_rgba(139,92,246,0.12)]',
    soft:
      'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    border:
      'border-violet-200/80 dark:border-violet-800/70',
    accent:
      'from-violet-500 to-fuchsia-400',
  },
  {
    marker:
      'bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]',
    soft:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    border:
      'border-emerald-200/80 dark:border-emerald-800/70',
    accent:
      'from-emerald-500 to-teal-400',
  },
  {
    marker:
      'bg-rose-500 shadow-[0_0_0_5px_rgba(244,63,94,0.12)]',
    soft:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    border:
      'border-rose-200/80 dark:border-rose-800/70',
    accent:
      'from-rose-500 to-pink-400',
  },
];

/* ============================================================
   DATE FORMATTERS
============================================================ */

const formatDate = (value, includeYear = false) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
    timeZone: 'Asia/Kolkata',
  });
};

const formatTime = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
};

/* ============================================================
   ANIMATION VARIANTS
============================================================ */

const listVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 22,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

/* ============================================================
   SMALL UI COMPONENTS
============================================================ */

const StatCard = ({
  icon,
  value,
  label,
  description,
  iconClassName,
}) => {
  return (
    <div
      className="
        group relative overflow-hidden
        rounded-2xl
        border border-slate-200/80
        bg-white
        px-3.5 py-3.5
        shadow-[0_8px_30px_-24px_rgba(15,23,42,0.45)]
        transition-all duration-300
        hover:-translate-y-0.5
        hover:border-slate-300
        hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.5)]
        dark:border-slate-800
        dark:bg-slate-900/90
        dark:hover:border-slate-700
        sm:px-4 sm:py-4
      "
    >
      <div
        className="
          pointer-events-none
          absolute -right-8 -top-8
          h-20 w-20 rounded-full
          bg-slate-100/70
          blur-2xl
          dark:bg-slate-800/50
        "
      />

      <div className="relative flex items-center gap-3">
        <div
          className={`
            flex h-10 w-10 shrink-0
            items-center justify-center
            rounded-xl
            ${iconClassName}
          `}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <p
              className="
                text-lg font-extrabold
                tracking-tight
                text-slate-950
                dark:text-white
                sm:text-xl
              "
            >
              {value}
            </p>

            {description && (
              <span
                className="
                  hidden truncate
                  text-[10px] font-medium
                  text-slate-400
                  dark:text-slate-500
                  sm:inline
                "
              >
                {description}
              </span>
            )}
          </div>

          <p
            className="
              mt-0.5
              text-[10px] font-semibold uppercase
              tracking-[0.08em]
              text-slate-500
              dark:text-slate-400
              sm:text-[11px]
            "
          >
            {label}
          </p>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   PLACE CARD
============================================================ */

const PlaceCard = ({
  place,
  index,
  isExpanded,
  isLeft,
  currentUsername,
  onToggle,
  onDelete,
}) => {
  const style = MARKER_STYLES[index % MARKER_STYLES.length];

  const hasPhoto = Boolean(place?.photo_url);

  const isOwner =
    currentUsername &&
    currentUsername === place?.created_by;

  return (
    <motion.div
      variants={cardVariants}
      className={`
        relative w-full
        md:w-[calc(50%-38px)]
        ${isLeft ? 'md:mr-auto' : 'md:ml-auto'}
      `}
    >
      {/* ======================================================
          DESKTOP CONNECTION
      ====================================================== */}

      <div
        className={`
          pointer-events-none
          absolute top-1/2 hidden
          h-px
          w-10
          -translate-y-1/2
          md:block
          ${
            isLeft
              ? '-right-10 bg-gradient-to-r from-transparent to-slate-300 dark:to-slate-700'
              : '-left-10 bg-gradient-to-l from-transparent to-slate-300 dark:to-slate-700'
          }
        `}
      />

      {/* ======================================================
          CARD
      ====================================================== */}

      <div
        className={`
          group relative overflow-hidden
          rounded-[24px]
          border
          bg-white
          shadow-[0_16px_50px_-32px_rgba(15,23,42,0.55)]
          transition-all duration-300
          hover:-translate-y-1
          hover:shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)]
          dark:bg-slate-900/90
          ${style.border}
        `}
      >
        {/* Top accent */}
        <div
          className={`
            absolute inset-x-0 top-0 h-[3px]
            bg-gradient-to-r
            ${style.accent}
            opacity-80
          `}
        />

        {/* ====================================================
            CLICKABLE SUMMARY
        ==================================================== */}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className="
            block w-full
            text-left
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-primary-500
            focus-visible:ring-inset
          "
        >
          <div className="flex gap-3 p-3.5 sm:gap-4 sm:p-4">
            {/* PHOTO */}
            <div
              className="
                relative
                h-[88px] w-[88px]
                shrink-0
                overflow-hidden
                rounded-[18px]
                bg-slate-100
                ring-1 ring-black/5
                dark:bg-slate-800
                dark:ring-white/5
                sm:h-[118px] sm:w-[118px]
                lg:h-[128px] lg:w-[128px]
              "
            >
              {hasPhoto ? (
                <img
                  src={place.photo_url}
                  alt={place.name || 'Visited place'}
                  loading="lazy"
                  className="
                    h-full w-full
                    object-cover
                    transition-transform
                    duration-700
                    ease-out
                    group-hover:scale-[1.04]
                  "
                />
              ) : (
                <div
                  className="
                    flex h-full w-full
                    flex-col
                    items-center justify-center
                    gap-1.5
                    text-slate-400
                    dark:text-slate-500
                  "
                >
                  <FaImage className="h-6 w-6" />

                  <span
                    className="
                      text-[9px] font-semibold
                      uppercase tracking-wider
                    "
                  >
                    No photo
                  </span>
                </div>
              )}

              {/* Photo gradient */}
              <div
                className="
                  pointer-events-none
                  absolute inset-0
                  bg-gradient-to-t
                  from-black/30
                  via-transparent
                  to-transparent
                "
              />

              {/* Stop number */}
              <div
                className="
                  absolute bottom-2 left-2
                  flex h-7 min-w-7
                  items-center justify-center
                  rounded-full
                  border border-white/40
                  bg-black/45
                  px-2
                  text-[10px]
                  font-extrabold
                  text-white
                  backdrop-blur-md
                "
              >
                {String(index + 1).padStart(2, '0')}
              </div>
            </div>

            {/* CONTENT */}
            <div className="min-w-0 flex-1">
              {/* TITLE */}
              <div className="flex items-start gap-2">
                <h3
                  className="
                    line-clamp-2
                    flex-1
                    text-[15px]
                    font-extrabold
                    leading-5
                    tracking-tight
                    text-slate-950
                    dark:text-white
                    sm:text-lg sm:leading-6
                  "
                >
                  {place.name || 'Unnamed place'}
                </h3>

                <span
                  className={`
                    hidden shrink-0
                    rounded-full
                    px-2 py-1
                    text-[9px]
                    font-extrabold
                    uppercase
                    tracking-wider
                    sm:inline-flex
                    ${style.soft}
                  `}
                >
                  Stop {index + 1}
                </span>
              </div>

              {/* LOCATION */}
              {place.location && (
                <div
                  className="
                    mt-2
                    flex min-w-0
                    items-center gap-1.5
                    text-[10px]
                    font-medium
                    text-slate-500
                    dark:text-slate-400
                    sm:text-[11px]
                  "
                >
                  <FaMapMarkerAlt
                    className="
                      h-2.5 w-2.5
                      shrink-0
                      text-primary-500
                    "
                  />

                  <span className="truncate">
                    {place.location}
                  </span>
                </div>
              )}

              {/* DATE */}
              {place.visited_time && (
                <div
                  className="
                    mt-1.5
                    flex items-center gap-1.5
                    text-[10px]
                    font-medium
                    text-slate-500
                    dark:text-slate-400
                    sm:text-[11px]
                  "
                >
                  <FaCalendarAlt
                    className="
                      h-2.5 w-2.5
                      shrink-0
                    "
                  />

                  <span>
                    {formatDate(place.visited_time)}
                  </span>

                  <span className="text-slate-300 dark:text-slate-600">
                    ·
                  </span>

                  <span>
                    {formatTime(place.visited_time)}
                  </span>
                </div>
              )}

              {/* CONTRIBUTOR */}
              {place.created_by && (
                <div
                  className="
                    mt-1.5
                    flex min-w-0
                    items-center gap-1.5
                    text-[10px]
                    font-medium
                    text-slate-500
                    dark:text-slate-400
                    sm:text-[11px]
                  "
                >
                  <FaUser
                    className="
                      h-2.5 w-2.5
                      shrink-0
                    "
                  />

                  <span className="truncate">
                    Added by {place.created_by}
                  </span>
                </div>
              )}

              {/* DESCRIPTION PREVIEW */}
              {place.description && (
                <p
                  className="
                    mt-2
                    line-clamp-2
                    text-[10px]
                    leading-4
                    text-slate-600
                    dark:text-slate-300
                    sm:text-[11px]
                    sm:leading-5
                  "
                >
                  {place.description}
                </p>
              )}

              {/* MOBILE ACTION */}
              <div className="mt-2.5 flex items-center justify-between sm:mt-3">
                <span
                  className="
                    text-[10px]
                    font-bold
                    text-primary-600
                    dark:text-primary-400
                  "
                >
                  {isExpanded
                    ? 'Hide details'
                    : 'View details'}
                </span>

                <div
                  className="
                    flex h-7 w-7
                    items-center justify-center
                    rounded-full
                    bg-slate-100
                    text-slate-500
                    transition-colors
                    group-hover:bg-primary-50
                    group-hover:text-primary-600
                    dark:bg-slate-800
                    dark:text-slate-400
                    dark:group-hover:bg-primary-950/40
                    dark:group-hover:text-primary-400
                  "
                >
                  <FaChevronDown
                    className={`
                      h-2.5 w-2.5
                      transition-transform duration-300
                      ${
                        isExpanded
                          ? 'rotate-180'
                          : ''
                      }
                    `}
                  />
                </div>
              </div>
            </div>
          </div>
        </button>

        {/* ====================================================
            EXPANDED DETAILS
        ==================================================== */}

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{
                height: 0,
                opacity: 0,
              }}
              animate={{
                height: 'auto',
                opacity: 1,
              }}
              exit={{
                height: 0,
                opacity: 0,
              }}
              transition={{
                duration: 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="overflow-hidden"
            >
              <div
                className="
                  border-t
                  border-slate-200/80
                  bg-slate-50/70
                  p-3.5
                  dark:border-slate-800
                  dark:bg-slate-950/40
                  sm:p-4
                "
              >
                {/* LARGE PHOTO */}
                {hasPhoto && (
                  <div
                    className="
                      relative mb-4
                      overflow-hidden
                      rounded-[18px]
                      bg-slate-200
                      dark:bg-slate-800
                    "
                  >
                    <img
                      src={place.photo_url}
                      alt={place.name || 'Visited place'}
                      loading="lazy"
                      className="
                        h-48 w-full
                        object-cover
                        sm:h-60
                      "
                    />

                    <div
                      className="
                        absolute inset-x-0 bottom-0
                        bg-gradient-to-t
                        from-black/60
                        to-transparent
                        px-4 pb-3 pt-10
                      "
                    >
                      <p
                        className="
                          text-xs font-semibold
                          text-white
                        "
                      >
                        Stop {index + 1}
                      </p>
                    </div>
                  </div>
                )}

                {/* LOCATION CHIP */}
                {place.location && (
                  <div
                    className="
                      mb-3
                      inline-flex max-w-full
                      items-center gap-2
                      rounded-full
                      border border-slate-200
                      bg-white
                      px-3 py-1.5
                      text-[11px]
                      font-semibold
                      text-slate-700
                      shadow-sm
                      dark:border-slate-700
                      dark:bg-slate-900
                      dark:text-slate-200
                    "
                  >
                    <FaMapMarkerAlt
                      className="
                        h-3 w-3
                        shrink-0
                        text-primary-500
                      "
                    />

                    <span className="truncate">
                      {place.location}
                    </span>
                  </div>
                )}

                {/* INFORMATION GRID */}
                <div
                  className="
                    mb-4
                    grid
                    grid-cols-1
                    gap-2
                    sm:grid-cols-2
                  "
                >
                  {place.visited_time && (
                    <div
                      className="
                        flex items-center gap-3
                        rounded-xl
                        border border-slate-200/80
                        bg-white
                        px-3 py-2.5
                        dark:border-slate-800
                        dark:bg-slate-900
                      "
                    >
                      <div
                        className="
                          flex h-8 w-8
                          shrink-0
                          items-center justify-center
                          rounded-lg
                          bg-primary-50
                          text-primary-600
                          dark:bg-primary-950/40
                          dark:text-primary-400
                        "
                      >
                        <FaCalendarAlt className="h-3 w-3" />
                      </div>

                      <div className="min-w-0">
                        <p
                          className="
                            text-[9px]
                            font-bold uppercase
                            tracking-wider
                            text-slate-400
                          "
                        >
                          Visited
                        </p>

                        <p
                          className="
                            mt-0.5 truncate
                            text-[11px]
                            font-semibold
                            text-slate-700
                            dark:text-slate-200
                          "
                        >
                          {formatDate(
                            place.visited_time,
                            true
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {place.created_by && (
                    <div
                      className="
                        flex items-center gap-3
                        rounded-xl
                        border border-slate-200/80
                        bg-white
                        px-3 py-2.5
                        dark:border-slate-800
                        dark:bg-slate-900
                      "
                    >
                      <div
                        className="
                          flex h-8 w-8
                          shrink-0
                          items-center justify-center
                          rounded-lg
                          bg-violet-50
                          text-violet-600
                          dark:bg-violet-950/40
                          dark:text-violet-400
                        "
                      >
                        <FaUser className="h-3 w-3" />
                      </div>

                      <div className="min-w-0">
                        <p
                          className="
                            text-[9px]
                            font-bold uppercase
                            tracking-wider
                            text-slate-400
                          "
                        >
                          Added by
                        </p>

                        <p
                          className="
                            mt-0.5 truncate
                            text-[11px]
                            font-semibold
                            text-slate-700
                            dark:text-slate-200
                          "
                        >
                          {place.created_by}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* DESCRIPTION */}
                {place.description && (
                  <div
                    className="
                      rounded-xl
                      border border-slate-200/80
                      bg-white
                      p-3.5
                      dark:border-slate-800
                      dark:bg-slate-900
                    "
                  >
                    <p
                      className="
                        mb-1.5
                        text-[9px]
                        font-bold
                        uppercase
                        tracking-[0.12em]
                        text-slate-400
                      "
                    >
                      Memory
                    </p>

                    <p
                      className="
                        text-xs
                        leading-6
                        text-slate-600
                        dark:text-slate-300
                      "
                    >
                      {place.description}
                    </p>
                  </div>
                )}

                {/* FOOTER */}
                <div
                  className="
                    mt-4
                    flex
                    flex-wrap
                    items-center
                    justify-between
                    gap-3
                    border-t
                    border-slate-200/80
                    pt-3
                    dark:border-slate-800
                  "
                >
                  <div
                    className="
                      flex items-center gap-2
                      text-[10px]
                      font-medium
                      text-slate-400
                    "
                  >
                    <FaMapMarkedAlt className="h-3 w-3" />

                    <span>
                      Journey stop {index + 1}
                    </span>
                  </div>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(place.id);
                      }}
                      className="
                        inline-flex
                        min-h-9
                        items-center
                        gap-1.5
                        rounded-xl
                        border
                        border-red-200
                        bg-red-50
                        px-3
                        text-[10px]
                        font-bold
                        text-red-600
                        transition-all
                        hover:bg-red-100
                        active:scale-95
                        dark:border-red-900/50
                        dark:bg-red-950/30
                        dark:text-red-400
                        dark:hover:bg-red-950/50
                      "
                    >
                      <FaTrash className="h-2.5 w-2.5" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/* ============================================================
   MAIN COMPONENT
============================================================ */

export const PlacesTab = ({ tripId }) => {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);

  const [expandedPlaceId, setExpandedPlaceId] =
    useState(null);

  const [searchQuery, setSearchQuery] =
    useState('');

  const [filter, setFilter] =
    useState('all');

  /* ==========================================================
     LOAD PLACES
  ========================================================== */

  const loadPlaces = useCallback(async () => {
    if (!tripId) {
      setPlaces([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const response =
        await placesAPI.getTripPlaces(tripId);

      const data = Array.isArray(response?.data)
        ? response.data
        : [];

      const normalized = [...data].sort((a, b) => {
        const first = new Date(
          a?.visited_time || 0
        ).getTime();

        const second = new Date(
          b?.visited_time || 0
        ).getTime();

        return first - second;
      });

      setPlaces(normalized);
    } catch (error) {
      console.error(
        'Failed to load places:',
        error
      );

      toast.error(
        'Failed to load places'
      );

      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadPlaces();
  }, [loadPlaces]);

  /* ==========================================================
     GLOBAL ADD PLACE EVENT
  ========================================================== */

  useEffect(() => {
    const handleOpenPlaceForm = () => {
      setShowModal(true);
    };

    window.addEventListener(
      'open-place-form',
      handleOpenPlaceForm
    );

    return () => {
      window.removeEventListener(
        'open-place-form',
        handleOpenPlaceForm
      );
    };
  }, []);

  /* ==========================================================
     DELETE
  ========================================================== */

  const handleDelete = async (placeId) => {
    if (!placeId) {
      return;
    }

    const confirmed = window.confirm(
      'Remove this place from the trip?'
    );

    if (!confirmed) {
      return;
    }

    try {
      await placesAPI.delete(placeId);

      toast.success(
        'Place removed from your journey'
      );

      setExpandedPlaceId(null);

      await loadPlaces();
    } catch (error) {
      console.error(
        'Failed to delete place:',
        error
      );

      toast.error(
        'Failed to remove place'
      );
    }
  };

  /* ==========================================================
     CURRENT USER
  ========================================================== */

  let currentUsername = null;

  try {
    const storedUser = JSON.parse(
      localStorage.getItem('user') || 'null'
    );

    currentUsername =
      storedUser?.username || null;
  } catch (error) {
    currentUsername = null;
  }

  /* ==========================================================
     STATS
  ========================================================== */

  const photoCount = useMemo(
    () =>
      places.filter(
        (place) =>
          Boolean(place?.photo_url)
      ).length,
    [places]
  );

  const contributorCount = useMemo(
    () =>
      new Set(
        places
          .map(
            (place) =>
              place?.created_by
          )
          .filter(Boolean)
      ).size,
    [places]
  );

  const firstPlace = places[0];

  const lastPlace =
    places[places.length - 1];

  /* ==========================================================
     FILTERED PLACES
  ========================================================== */

  const filteredPlaces = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    return places.filter((place) => {
      const matchesSearch =
        !query ||
        String(place?.name || '')
          .toLowerCase()
          .includes(query) ||
        String(place?.location || '')
          .toLowerCase()
          .includes(query) ||
        String(place?.description || '')
          .toLowerCase()
          .includes(query);

      const matchesFilter =
        filter === 'all' ||
        (filter === 'photos' &&
          Boolean(place?.photo_url));

      return (
        matchesSearch &&
        matchesFilter
      );
    });
  }, [
    places,
    searchQuery,
    filter,
  ]);

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <div className="w-full">
        <div
          className="
            flex min-h-[420px]
            items-center justify-center
          "
        >
          <div className="text-center">
            <div
              className="
                mx-auto mb-4
                flex h-12 w-12
                items-center justify-center
                rounded-2xl
                border
                border-slate-200
                bg-white
                shadow-sm
                dark:border-slate-800
                dark:bg-slate-900
              "
            >
              <div
                className="
                  h-5 w-5
                  animate-spin
                  rounded-full
                  border-2
                  border-primary-500
                  border-t-transparent
                "
              />
            </div>

            <p
              className="
                text-sm font-semibold
                text-slate-700
                dark:text-slate-200
              "
            >
              Loading your journey
            </p>

            <p
              className="
                mt-1 text-xs
                text-slate-400
              "
            >
              Bringing your places together...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ==========================================================
     EMPTY STATE
  ========================================================== */

  if (places.length === 0) {
    return (
      <div className="w-full">
        {/* HERO */}
        <div
          className="
            relative mb-6
            overflow-hidden
            rounded-[28px]
            border
            border-slate-200/80
            bg-white
            p-5
            shadow-[0_20px_60px_-35px_rgba(15,23,42,0.5)]
            dark:border-slate-800
            dark:bg-slate-900/90
            sm:p-7
          "
        >
          <div
            className="
              pointer-events-none
              absolute -right-20 -top-24
              h-64 w-64
              rounded-full
              bg-primary-100/60
              blur-3xl
              dark:bg-primary-950/30
            "
          />

          <div
            className="
              pointer-events-none
              absolute -bottom-24 -left-20
              h-60 w-60
              rounded-full
              bg-sky-100/60
              blur-3xl
              dark:bg-sky-950/20
            "
          />

          <div
            className="
              relative
              flex
              flex-col
              gap-5
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div className="flex items-center gap-4">
              <div
                className="
                  flex h-12 w-12
                  shrink-0
                  items-center justify-center
                  rounded-2xl
                  bg-primary-50
                  text-primary-600
                  dark:bg-primary-950/40
                  dark:text-primary-400
                "
              >
                <FaRoute className="h-5 w-5" />
              </div>

              <div>
                <p
                  className="
                    text-[10px]
                    font-extrabold
                    uppercase
                    tracking-[0.15em]
                    text-primary-600
                    dark:text-primary-400
                  "
                >
                  Your journey
                </p>

                <h2
                  className="
                    mt-0.5
                    text-xl
                    font-extrabold
                    tracking-tight
                    text-slate-950
                    dark:text-white
                    sm:text-2xl
                  "
                >
                  Places Visited
                </h2>

                <p
                  className="
                    mt-1 text-xs
                    text-slate-500
                    dark:text-slate-400
                  "
                >
                  Save the places that made
                  this trip memorable.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowModal(true)
              }
              className="
                inline-flex
                min-h-11
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-primary-600
                px-4
                text-sm
                font-bold
                text-white
                shadow-[0_14px_30px_-16px_rgba(37,99,235,0.8)]
                transition-all
                hover:-translate-y-0.5
                hover:bg-primary-700
                hover:shadow-[0_18px_35px_-15px_rgba(37,99,235,0.8)]
                active:scale-[0.98]
              "
            >
              <FaPlus className="h-3 w-3" />
              Add Place
            </button>
          </div>
        </div>

        {/* EMPTY */}
        <motion.div
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.45,
          }}
          className="
            relative
            flex min-h-[380px]
            flex-col
            items-center
            justify-center
            overflow-hidden
            rounded-[28px]
            border
            border-dashed
            border-slate-300
            bg-gradient-to-br
            from-primary-50/70
            via-white
            to-sky-50/70
            px-6
            text-center
            dark:border-slate-700
            dark:from-primary-950/20
            dark:via-slate-900
            dark:to-sky-950/20
          "
        >
          {/* Decorative route */}
          <div
            className="
              pointer-events-none
              absolute left-1/2 top-0
              h-full w-px
              -translate-x-1/2
              border-l
              border-dashed
              border-primary-200
              dark:border-primary-900
            "
          />

          <div
            className="
              relative z-10
              flex h-16 w-16
              items-center justify-center
              rounded-[22px]
              bg-white
              text-primary-600
              shadow-[0_15px_40px_-20px_rgba(37,99,235,0.6)]
              ring-1 ring-slate-200/80
              dark:bg-slate-900
              dark:text-primary-400
              dark:ring-slate-800
            "
          >
            <FaMapMarkerAlt className="h-7 w-7" />
          </div>

          <h3
            className="
              relative z-10
              mt-5
              text-xl
              font-extrabold
              tracking-tight
              text-slate-950
              dark:text-white
            "
          >
            Your map is waiting
          </h3>

          <p
            className="
              relative z-10
              mt-2
              max-w-md
              text-sm
              leading-6
              text-slate-500
              dark:text-slate-400
            "
          >
            Add your first destination and
            start building a visual timeline
            of your trip.
          </p>

          <button
            type="button"
            onClick={() =>
              setShowModal(true)
            }
            className="
              relative z-10
              mt-6
              inline-flex
              min-h-11
              items-center
              gap-2
              rounded-xl
              bg-primary-600
              px-5
              text-sm
              font-bold
              text-white
              shadow-lg
              transition-all
              hover:-translate-y-0.5
              hover:bg-primary-700
              active:scale-[0.98]
            "
          >
            <FaPlus className="h-3 w-3" />
            Add your first place
          </button>
        </motion.div>

        <AddPlaceModal
          isOpen={showModal}
          onClose={() =>
            setShowModal(false)
          }
          onSuccess={loadPlaces}
          tripId={tripId}
        />
      </div>
    );
  }

  /* ==========================================================
     MAIN UI
  ========================================================== */

  return (
    <div className="w-full">
      {/* ======================================================
          HERO
      ====================================================== */}

      <motion.section
        initial={{
          opacity: 0,
          y: 10,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.4,
        }}
        className="
          relative mb-5
          overflow-hidden
          rounded-[28px]
          border
          border-slate-200/80
          bg-white
          shadow-[0_20px_60px_-38px_rgba(15,23,42,0.55)]
          dark:border-slate-800
          dark:bg-slate-900/90
        "
      >
        {/* Ambient background */}
        <div
          className="
            pointer-events-none
            absolute -right-24 -top-28
            h-72 w-72
            rounded-full
            bg-primary-100/70
            blur-3xl
            dark:bg-primary-950/30
          "
        />

        <div
          className="
            pointer-events-none
            absolute -bottom-32 -left-24
            h-72 w-72
            rounded-full
            bg-sky-100/60
            blur-3xl
            dark:bg-sky-950/20
          "
        />

        <div
          className="
            relative
            p-5
            sm:p-6
            lg:p-7
          "
        >
          <div
            className="
              flex
              flex-col
              gap-5
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >
            {/* LEFT */}
            <div
              className="
                flex min-w-0
                items-start gap-4
              "
            >
              <div
                className="
                  relative
                  flex h-12 w-12
                  shrink-0
                  items-center justify-center
                  rounded-2xl
                  bg-primary-50
                  text-primary-600
                  ring-1 ring-primary-100
                  dark:bg-primary-950/40
                  dark:text-primary-400
                  dark:ring-primary-900/50
                  sm:h-14 sm:w-14
                "
              >
                <FaRoute className="h-5 w-5 sm:h-6 sm:w-6" />

                <span
                  className="
                    absolute -bottom-1 -right-1
                    flex h-5 w-5
                    items-center justify-center
                    rounded-full
                    border-2 border-white
                    bg-emerald-500
                    dark:border-slate-900
                  "
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className="
                      text-[10px]
                      font-extrabold
                      uppercase
                      tracking-[0.16em]
                      text-primary-600
                      dark:text-primary-400
                    "
                  >
                    Trip memories
                  </p>

                  <span
                    className="
                      hidden h-1 w-1
                      rounded-full
                      bg-slate-300
                      sm:block
                      dark:bg-slate-700
                    "
                  />
                </div>

                <h2
                  className="
                    mt-1
                    text-2xl
                    font-black
                    tracking-tight
                    text-slate-950
                    dark:text-white
                    sm:text-3xl
                  "
                >
                  Places Visited
                </h2>

                <p
                  className="
                    mt-1
                    max-w-xl
                    text-xs
                    leading-5
                    text-slate-500
                    dark:text-slate-400
                    sm:text-sm
                  "
                >
                  Follow the route and revisit
                  the moments that made this
                  trip yours.
                </p>
              </div>
            </div>

            {/* RIGHT */}
            <button
              type="button"
              onClick={() =>
                setShowModal(true)
              }
              className="
                inline-flex
                min-h-11
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-primary-600
                px-5
                text-sm
                font-bold
                text-white
                shadow-[0_14px_30px_-16px_rgba(37,99,235,0.85)]
                transition-all
                hover:-translate-y-0.5
                hover:bg-primary-700
                active:scale-[0.98]
                sm:w-auto
              "
            >
              <FaPlus className="h-3 w-3" />
              Add Place
            </button>
          </div>

          {/* JOURNEY META */}
          <div
            className="
              mt-5
              flex
              flex-wrap
              items-center
              gap-x-4
              gap-y-2
              border-t
              border-slate-100
              pt-4
              dark:border-slate-800
            "
          >
            {firstPlace && (
              <div
                className="
                  flex min-w-0
                  items-center gap-2
                  text-[10px]
                  font-medium
                  text-slate-500
                  dark:text-slate-400
                "
              >
                <FaFlag
                  className="
                    h-2.5 w-2.5
                    text-primary-500
                  "
                />

                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  Start
                </span>

                <span className="max-w-[140px] truncate">
                  {firstPlace.name ||
                    'First stop'}
                </span>
              </div>
            )}

            {lastPlace &&
              places.length > 1 && (
                <>
                  <FaArrowRight
                    className="
                      hidden h-2.5 w-2.5
                      text-slate-300
                      sm:block
                      dark:text-slate-700
                    "
                  />

                  <div
                    className="
                      flex min-w-0
                      items-center gap-2
                      text-[10px]
                      font-medium
                      text-slate-500
                      dark:text-slate-400
                    "
                  >
                    <FaMapMarkerAlt
                      className="
                        h-2.5 w-2.5
                        text-rose-500
                      "
                    />

                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Latest
                    </span>

                    <span className="max-w-[140px] truncate">
                      {lastPlace.name ||
                        'Latest stop'}
                    </span>
                  </div>
                </>
              )}
          </div>
        </div>
      </motion.section>

      {/* ======================================================
          STATS
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
          duration: 0.4,
          delay: 0.08,
        }}
        className="
          mb-5
          grid
          grid-cols-3
          gap-2
          sm:gap-3
        "
      >
        <StatCard
          icon={
            <FaFlag className="h-4 w-4" />
          }
          value={places.length}
          label="Stops"
          description="on this trip"
          iconClassName="
            bg-orange-50
            text-orange-600
            dark:bg-orange-950/40
            dark:text-orange-400
          "
        />

        <StatCard
          icon={
            <FaUsers className="h-4 w-4" />
          }
          value={contributorCount}
          label="Contributors"
          description="people adding memories"
          iconClassName="
            bg-violet-50
            text-violet-600
            dark:bg-violet-950/40
            dark:text-violet-400
          "
        />

        <StatCard
          icon={
            <FaCamera className="h-4 w-4" />
          }
          value={photoCount}
          label="Photos"
          description="visual memories"
          iconClassName="
            bg-emerald-50
            text-emerald-600
            dark:bg-emerald-950/40
            dark:text-emerald-400
          "
        />
      </motion.div>

      {/* ======================================================
          TOOLBAR
      ====================================================== */}

      <motion.div
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        transition={{
          duration: 0.35,
          delay: 0.12,
        }}
        className="
          mb-6
          flex
          flex-col
          gap-3
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        {/* SEARCH */}
        <div
          className="
            relative
            w-full
            sm:max-w-xs
          "
        >
          <FaSearch
            className="
              pointer-events-none
              absolute left-3.5 top-1/2
              h-3 w-3
              -translate-y-1/2
              text-slate-400
            "
          />

          <input
            type="search"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value
              )
            }
            placeholder="Search places..."
            className="
              h-10
              w-full
              rounded-xl
              border
              border-slate-200
              bg-white
              pl-9 pr-9
              text-xs
              font-medium
              text-slate-800
              outline-none
              placeholder:text-slate-400
              transition-all
              focus:border-primary-400
              focus:ring-4
              focus:ring-primary-500/10
              dark:border-slate-800
              dark:bg-slate-900
              dark:text-white
              dark:placeholder:text-slate-500
            "
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() =>
                setSearchQuery('')
              }
              className="
                absolute right-2
                top-1/2
                flex h-6 w-6
                -translate-y-1/2
                items-center justify-center
                rounded-lg
                text-slate-400
                transition-colors
                hover:bg-slate-100
                hover:text-slate-600
                dark:hover:bg-slate-800
                dark:hover:text-slate-200
              "
              aria-label="Clear search"
            >
              <FaTimes className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        {/* FILTER */}
        <div
          className="
            flex
            items-center
            gap-1
            self-start
            rounded-xl
            border
            border-slate-200
            bg-white
            p-1
            dark:border-slate-800
            dark:bg-slate-900
            sm:self-auto
          "
        >
          <button
            type="button"
            onClick={() =>
              setFilter('all')
            }
            className={`
              min-h-8
              rounded-lg
              px-3
              text-[10px]
              font-bold
              transition-all
              ${
                filter === 'all'
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }
            `}
          >
            All
          </button>

          <button
            type="button"
            onClick={() =>
              setFilter('photos')
            }
            className={`
              min-h-8
              rounded-lg
              px-3
              text-[10px]
              font-bold
              transition-all
              ${
                filter === 'photos'
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }
            `}
          >
            With photos
          </button>
        </div>
      </motion.div>

      {/* ======================================================
          RESULT INFO
      ====================================================== */}

      {(searchQuery ||
        filter !== 'all') && (
        <div
          className="
            mb-5
            flex
            items-center
            justify-between
            gap-3
          "
        >
          <p
            className="
              text-[11px]
              font-medium
              text-slate-500
              dark:text-slate-400
            "
          >
            Showing{' '}
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {filteredPlaces.length}
            </span>{' '}
            of{' '}
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {places.length}
            </span>{' '}
            places
          </p>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilter('all');
            }}
            className="
              text-[10px]
              font-bold
              text-primary-600
              hover:underline
              dark:text-primary-400
            "
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ======================================================
          NO FILTER RESULTS
      ====================================================== */}

      {filteredPlaces.length === 0 && (
        <motion.div
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="
            rounded-[24px]
            border
            border-slate-200
            bg-white
            px-6 py-14
            text-center
            dark:border-slate-800
            dark:bg-slate-900
          "
        >
          <div
            className="
              mx-auto
              flex h-12 w-12
              items-center justify-center
              rounded-2xl
              bg-slate-100
              text-slate-400
              dark:bg-slate-800
              dark:text-slate-500
            "
          >
            <FaSearch className="h-4 w-4" />
          </div>

          <h3
            className="
              mt-4
              text-sm
              font-extrabold
              text-slate-900
              dark:text-white
            "
          >
            No places found
          </h3>

          <p
            className="
              mx-auto mt-1
              max-w-sm
              text-xs
              leading-5
              text-slate-500
              dark:text-slate-400
            "
          >
            Try another search term or
            change the current filter.
          </p>
        </motion.div>
      )}

      {/* ======================================================
          JOURNEY TIMELINE
      ====================================================== */}

      {filteredPlaces.length > 0 && (
        <div
          className="
            relative
            mx-auto
            w-full
            max-w-6xl
            pb-10
          "
        >
          {/* ==================================================
              DESKTOP ROAD
          ================================================== */}

          <div
            className="
              pointer-events-none
              absolute
              inset-y-0
              left-1/2
              z-0
              hidden
              w-20
              -translate-x-1/2
              md:block
            "
            aria-hidden="true"
          >
            {/* Soft glow */}
            <div
              className="
                absolute
                left-1/2
                top-0
                h-full
                w-8
                -translate-x-1/2
                bg-primary-500/[0.025]
                blur-xl
                dark:bg-primary-400/[0.03]
              "
            />

            {/* Main route */}
            <div
              className="
                absolute
                left-1/2
                top-0
                h-full
                w-[2px]
                -translate-x-1/2
                overflow-hidden
                rounded-full
                bg-slate-200
                dark:bg-slate-800
              "
            >
              <motion.div
                initial={{
                  scaleY: 0,
                }}
                animate={{
                  scaleY: 1,
                }}
                transition={{
                  duration: 1.2,
                  ease: 'easeInOut',
                }}
                className="
                  h-full w-full
                  origin-top
                  bg-gradient-to-b
                  from-primary-400
                  via-sky-400
                  to-primary-400
                  opacity-70
                "
              />
            </div>

            {/* Moving route light */}
            <motion.div
              animate={{
                y: ['0%', '100%'],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="
                absolute
                left-1/2
                top-0
                h-16
                w-[3px]
                -translate-x-1/2
                rounded-full
                bg-gradient-to-b
                from-transparent
                via-white
                to-transparent
                opacity-80
                dark:via-sky-200
              "
            />
          </div>

          {/* ==================================================
              MOBILE ROAD
          ================================================== */}

          <div
            className="
              pointer-events-none
              absolute
              inset-y-0
              left-[21px]
              z-0
              block
              w-5
              sm:left-[25px]
              md:hidden
            "
            aria-hidden="true"
          >
            <div
              className="
                absolute
                left-1/2
                top-0
                h-full
                w-[2px]
                -translate-x-1/2
                overflow-hidden
                rounded-full
                bg-slate-200
                dark:bg-slate-800
              "
            >
              <motion.div
                initial={{
                  scaleY: 0,
                }}
                animate={{
                  scaleY: 1,
                }}
                transition={{
                  duration: 1,
                  ease: 'easeOut',
                }}
                className="
                  h-full w-full
                  origin-top
                  bg-gradient-to-b
                  from-primary-400
                  via-sky-400
                  to-primary-400
                "
              />
            </div>
          </div>

          {/* ==================================================
              PLACES
          ================================================== */}

          <motion.div
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="
              relative
              z-10
              space-y-7
              sm:space-y-8
              md:space-y-12
            "
          >
            {filteredPlaces.map(
              (place, index) => {
                const originalIndex =
                  places.findIndex(
                    (item) =>
                      item.id === place.id
                  );

                const safeIndex =
                  originalIndex >= 0
                    ? originalIndex
                    : index;

                const isExpanded =
                  expandedPlaceId ===
                  place.id;

                const isLeft =
                  index % 2 === 0;

                const style =
                  MARKER_STYLES[
                    safeIndex %
                      MARKER_STYLES.length
                  ];

                return (
                  <div
                    key={place.id}
                    className="
                      relative
                      min-h-0
                      md:min-h-[190px]
                    "
                  >
                    {/* =================================================
                        MOBILE NODE
                    ================================================= */}

                    <motion.div
                      initial={{
                        scale: 0,
                        opacity: 0,
                      }}
                      animate={{
                        scale: 1,
                        opacity: 1,
                      }}
                      transition={{
                        duration: 0.3,
                        delay:
                          index * 0.05,
                      }}
                      className={`
                        absolute
                        left-0
                        top-1/2
                        z-30
                        flex
                        h-[44px]
                        w-[44px]
                        -translate-y-1/2
                        items-center
                        justify-center
                        rounded-full
                        border-[3px]
                        border-white
                        text-xs
                        font-black
                        text-white
                        md:hidden
                        dark:border-slate-950
                        ${style.marker}
                      `}
                    >
                      {index + 1}
                    </motion.div>

                    {/* =================================================
                        DESKTOP NODE
                    ================================================= */}

                    <motion.div
                      initial={{
                        scale: 0,
                        opacity: 0,
                      }}
                      animate={{
                        scale: 1,
                        opacity: 1,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 260,
                        damping: 18,
                        delay:
                          index * 0.05,
                      }}
                      className={`
                        absolute
                        left-1/2
                        top-1/2
                        z-30
                        hidden
                        h-[50px]
                        w-[50px]
                        -translate-x-1/2
                        -translate-y-1/2
                        items-center
                        justify-center
                        rounded-full
                        border-[4px]
                        border-white
                        text-sm
                        font-black
                        text-white
                        md:flex
                        dark:border-slate-950
                        ${style.marker}
                      `}
                    >
                      {index + 1}
                    </motion.div>

                    {/* =================================================
                        MOBILE CARD OFFSET
                    ================================================= */}

                    <div
                      className="
                        pl-[58px]
                        sm:pl-[66px]
                        md:pl-0
                      "
                    >
                      <PlaceCard
                        place={place}
                        index={index}
                        isExpanded={
                          isExpanded
                        }
                        isLeft={isLeft}
                        currentUsername={
                          currentUsername
                        }
                        onToggle={() =>
                          setExpandedPlaceId(
                            isExpanded
                              ? null
                              : place.id
                          )
                        }
                        onDelete={
                          handleDelete
                        }
                      />
                    </div>
                  </div>
                );
              }
            )}
          </motion.div>
        </div>
      )}

      {/* ======================================================
          BOTTOM JOURNEY FOOTER
      ====================================================== */}

      {filteredPlaces.length > 1 &&
        !searchQuery &&
        filter === 'all' && (
          <motion.div
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.4,
              delay: 0.2,
            }}
            className="
              mx-auto
              mt-2
              max-w-xl
              rounded-2xl
              border
              border-slate-200/80
              bg-slate-50/80
              px-4 py-3
              text-center
              dark:border-slate-800
              dark:bg-slate-900/60
            "
          >
            <div
              className="
                flex
                items-center
                justify-center
                gap-2
              "
            >
              <FaClock
                className="
                  h-3 w-3
                  text-primary-500
                "
              />

              <p
                className="
                  text-[10px]
                  font-semibold
                  text-slate-500
                  dark:text-slate-400
                "
              >
                Your journey has{' '}
                <span
                  className="
                    font-extrabold
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {places.length}
                </span>{' '}
                memorable stops
              </p>
            </div>
          </motion.div>
        )}

      {/* ======================================================
          MODAL
      ====================================================== */}

      <AddPlaceModal
        isOpen={showModal}
        onClose={() =>
          setShowModal(false)
        }
        onSuccess={loadPlaces}
        tripId={tripId}
      />
    </div>
  );
};

export default PlacesTab;