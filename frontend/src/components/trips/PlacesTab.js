// src/components/trips/PlacesTab.js

import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-icons/fa';

import { placesAPI } from '../../services/api';
import { AddPlaceModal } from './AddPlaceModal';

/* ============================================================
   MARKER STYLES
============================================================ */

const MARKER_STYLES = [
  {
    marker: 'bg-sky-500',
    badge:
      'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    border:
      'border-sky-200 dark:border-sky-800',
  },
  {
    marker: 'bg-orange-500',
    badge:
      'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    border:
      'border-orange-200 dark:border-orange-800',
  },
  {
    marker: 'bg-violet-500',
    badge:
      'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    border:
      'border-violet-200 dark:border-violet-800',
  },
  {
    marker: 'bg-emerald-500',
    badge:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    border:
      'border-emerald-200 dark:border-emerald-800',
  },
  {
    marker: 'bg-rose-500',
    badge:
      'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    border:
      'border-rose-200 dark:border-rose-800',
  },
];

/* ============================================================
   DATE FORMATTER
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

/* ============================================================
   COMPONENT
============================================================ */

export const PlacesTab = ({ tripId }) => {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandedPlaceId, setExpandedPlaceId] = useState(null);

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

      const response = await placesAPI.getTripPlaces(tripId);

      const data = Array.isArray(response?.data)
        ? response.data
        : [];

      const normalized = [...data].sort((a, b) => {
        const first = new Date(a?.visited_time || 0).getTime();
        const second = new Date(b?.visited_time || 0).getTime();

        return first - second;
      });

      setPlaces(normalized);
    } catch (error) {
      console.error('Failed to load places:', error);
      toast.error('Failed to load places');
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
     DELETE PLACE
  ========================================================== */

  const handleDelete = async (placeId) => {
    if (!placeId) {
      return;
    }

    const confirmed = window.confirm(
      'Delete this place?'
    );

    if (!confirmed) {
      return;
    }

    try {
      await placesAPI.delete(placeId);

      toast.success('Place deleted');

      setExpandedPlaceId(null);

      await loadPlaces();
    } catch (error) {
      console.error(
        'Failed to delete place:',
        error
      );

      toast.error('Failed to delete place');
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

    currentUsername = storedUser?.username || null;
  } catch (error) {
    currentUsername = null;
  }

  /* ==========================================================
     STATS
  ========================================================== */

  const photoCount = places.filter(
    (place) => Boolean(place?.photo_url)
  ).length;

  const contributorCount = new Set(
    places
      .map((place) => place?.created_by)
      .filter(Boolean)
  ).size;

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <div className="flex min-h-[320px] w-full items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <span>Loading your journey...</span>
        </div>
      </div>
    );
  }

  /* ==========================================================
     EMPTY STATE
  ========================================================== */

  if (places.length === 0) {
    return (
      <div className="w-full px-1 sm:px-0">

        {/* HEADER */}

        <div className="mb-7 flex items-center justify-between gap-4">

          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400">
              <FaRoute className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Places Visited
              </h2>

              <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                Your beautiful journey timeline
              </p>
            </div>

          </div>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="
              inline-flex
              shrink-0
              items-center
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
              hover:-translate-y-0.5
              hover:bg-primary-700
              hover:shadow-md
              active:scale-95
            "
          >
            <FaPlus className="h-3.5 w-3.5" />

            <span className="hidden sm:inline">
              Add Place
            </span>

            <span className="sm:hidden">
              Add
            </span>
          </button>

        </div>

        {/* EMPTY CARD */}

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
            duration: 0.35,
          }}
          className="
            flex
            min-h-[340px]
            flex-col
            items-center
            justify-center
            rounded-[28px]
            border
            border-dashed
            border-gray-300
            bg-gradient-to-br
            from-primary-50
            via-white
            to-sky-50
            px-6
            text-center
            dark:border-gray-700
            dark:from-primary-950/20
            dark:via-gray-900
            dark:to-sky-950/20
          "
        >

          <div className="
            mb-5
            flex
            h-16
            w-16
            items-center
            justify-center
            rounded-2xl
            bg-primary-100
            text-primary-600
            shadow-sm
            dark:bg-primary-900/40
            dark:text-primary-400
          ">
            <FaMapMarkerAlt className="h-7 w-7" />
          </div>

          <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
            Your journey starts here
          </h3>

          <p className="mb-6 max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">
            Start adding the places you visit and
            build a beautiful timeline of your trip.
          </p>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="
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
              transition-all
              hover:-translate-y-0.5
              hover:bg-primary-700
              active:scale-95
            "
          >
            <FaPlus className="h-3.5 w-3.5" />
            Add First Place
          </button>

        </motion.div>

        <AddPlaceModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={loadPlaces}
          tripId={tripId}
        />

      </div>
    );
  }

  /* ==========================================================
     MAIN
  ========================================================== */

  return (
    <div className="w-full">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="
        mb-6
        flex
        flex-col
        gap-4
        sm:mb-7
        sm:flex-row
        sm:items-center
        sm:justify-between
      ">

        <div className="flex min-w-0 items-center gap-3">

          <div className="
            flex
            h-12
            w-12
            shrink-0
            items-center
            justify-center
            rounded-2xl
            bg-primary-50
            text-primary-600
            shadow-sm
            dark:bg-primary-950/40
            dark:text-primary-400
          ">
            <FaRoute className="h-5 w-5" />
          </div>

          <div className="min-w-0">

            <h2 className="
              text-2xl
              font-extrabold
              tracking-tight
              text-slate-900
              dark:text-white
              sm:text-3xl
            ">
              Places Visited
            </h2>

            <p className="
              mt-0.5
              text-sm
              font-medium
              text-slate-500
              dark:text-slate-400
            ">
              {places.length}{' '}
              {places.length === 1
                ? 'place'
                : 'places'}{' '}
              discovered on this trip
            </p>

          </div>

        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="
            inline-flex
            w-full
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-primary-600
            px-5
            py-3
            text-sm
            font-bold
            text-white
            shadow-[0_12px_25px_-15px_rgba(37,99,235,0.8)]
            transition-all
            hover:-translate-y-0.5
            hover:bg-primary-700
            hover:shadow-lg
            active:scale-[0.98]
            sm:w-auto
          "
        >
          <FaPlus className="h-3.5 w-3.5" />
          Add Place
        </button>

      </div>

      {/* ======================================================
          STATS
      ====================================================== */}

      <div className="mb-7 w-full pb-1">

        <div className="
          grid
          grid-cols-3
          gap-2
          sm:gap-3
        ">

          {/* STOPS */}

          <div className="
            flex
            items-center
            gap-2
            rounded-2xl
            border
            border-slate-200
            bg-white
            px-2.5
            py-2.5
            shadow-sm
            dark:border-slate-700
            dark:bg-slate-800
            sm:gap-3
            sm:px-3.5
            sm:py-3.5
          ">

            <div className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-orange-50
              text-orange-500
              dark:bg-orange-950/30
              dark:text-orange-400
              sm:h-10
              sm:w-10
            ">
              <FaFlag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>

            <div className="min-w-0">
              <p className="text-lg font-extrabold leading-none text-slate-900 dark:text-white sm:text-xl">
                {places.length}
              </p>

              <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">
                Stops
              </p>
            </div>

          </div>

          {/* CONTRIBUTORS */}

          <div className="
            flex
            items-center
            gap-2
            rounded-2xl
            border
            border-slate-200
            bg-white
            px-2.5
            py-2.5
            shadow-sm
            dark:border-slate-700
            dark:bg-slate-800
            sm:gap-3
            sm:px-3.5
            sm:py-3.5
          ">

            <div className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-violet-50
              text-violet-600
              dark:bg-violet-950/30
              dark:text-violet-400
              sm:h-10
              sm:w-10
            ">
              <FaUsers className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>

            <div className="min-w-0">
              <p className="text-lg font-extrabold leading-none text-slate-900 dark:text-white sm:text-xl">
                {contributorCount}
              </p>

              <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">
                Contributors
              </p>
            </div>

          </div>

          {/* PHOTOS */}

          <div className="
            flex
            items-center
            gap-2
            rounded-2xl
            border
            border-slate-200
            bg-white
            px-2.5
            py-2.5
            shadow-sm
            dark:border-slate-700
            dark:bg-slate-800
            sm:gap-3
            sm:px-3.5
            sm:py-3.5
          ">

            <div className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-emerald-50
              text-emerald-600
              dark:bg-emerald-950/30
              dark:text-emerald-400
              sm:h-10
              sm:w-10
            ">
              <FaCamera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>

            <div className="min-w-0">
              <p className="text-lg font-extrabold leading-none text-slate-900 dark:text-white sm:text-xl">
                {photoCount}
              </p>

              <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">
                Photos
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* ======================================================
          TIMELINE
      ====================================================== */}

      <div className="
        relative
        mx-auto
        w-full
        max-w-7xl
        overflow-hidden
        pb-10
      ">

        {/* ====================================================
            DESKTOP ROAD
        ==================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            inset-y-0
            left-1/2
            hidden
            w-[180px]
            -translate-x-1/2
            md:block
          "
          aria-hidden="true"
        >

          <svg
            viewBox="0 0 180 1000"
            preserveAspectRatio="none"
            className="h-full w-full"
          >

            {/* ROAD GLOW */}

            <path
              d="
                M90 0
                C90 65 145 80 145 150
                C145 220 35 230 35 300
                C35 370 145 380 145 450
                C145 520 35 530 35 600
                C35 670 145 680 145 750
                C145 820 90 850 90 1000
              "
              fill="none"
              stroke="rgba(14,165,233,0.10)"
              strokeWidth="44"
              strokeLinecap="round"
            />

            {/* ROAD */}

            <path
              d="
                M90 0
                C90 65 145 80 145 150
                C145 220 35 230 35 300
                C35 370 145 380 145 450
                C145 520 35 530 35 600
                C35 670 145 680 145 750
                C145 820 90 850 90 1000
              "
              fill="none"
              stroke="#1e293b"
              strokeWidth="30"
              strokeLinecap="round"
              className="dark:stroke-slate-600"
            />

            {/* ROAD DASHES */}

            <path
              d="
                M90 0
                C90 65 145 80 145 150
                C145 220 35 230 35 300
                C35 370 145 380 145 450
                C145 520 35 530 35 600
                C35 670 145 680 145 750
                C145 820 90 850 90 1000
              "
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeDasharray="10 14"
              strokeLinecap="round"
            />

          </svg>

        </div>

        {/* ====================================================
            MOBILE ROAD
        ==================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            inset-y-0
            left-0
            block
            w-[62px]
            md:hidden
          "
          aria-hidden="true"
        >

          <svg
            viewBox="0 0 62 1000"
            preserveAspectRatio="none"
            className="h-full w-full"
          >

            {/* GLOW */}

            <path
              d="
                M31 0
                C31 65 48 80 48 145
                C48 215 14 230 14 300
                C14 370 48 385 48 450
                C48 520 14 535 14 600
                C14 670 48 685 48 750
                C48 820 31 850 31 1000
              "
              fill="none"
              stroke="rgba(14,165,233,0.10)"
              strokeWidth="30"
              strokeLinecap="round"
            />

            {/* ROAD */}

            <path
              d="
                M31 0
                C31 65 48 80 48 145
                C48 215 14 230 14 300
                C14 370 48 385 48 450
                C48 520 14 535 14 600
                C14 670 48 685 48 750
                C48 820 31 850 31 1000
              "
              fill="none"
              stroke="#1e293b"
              strokeWidth="21"
              strokeLinecap="round"
              className="dark:stroke-slate-600"
            />

            {/* DASHES */}

            <path
              d="
                M31 0
                C31 65 48 80 48 145
                C48 215 14 230 14 300
                C14 370 48 385 48 450
                C48 520 14 535 14 600
                C14 670 48 685 48 750
                C48 820 31 850 31 1000
              "
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeDasharray="8 11"
              strokeLinecap="round"
            />

          </svg>

        </div>

        {/* ====================================================
            PLACE LIST
        ==================================================== */}

        <div className="relative z-10 space-y-8 md:space-y-10">

          {places.map((place, index) => {

            const isExpanded =
              expandedPlaceId === place.id;

            const isLeft =
              index % 2 === 0;

            const hasPhoto =
              Boolean(place?.photo_url);

            const style =
              MARKER_STYLES[
                index % MARKER_STYLES.length
              ];

            return (
              <motion.div
                key={place.id}
                initial={{
                  opacity: 0,
                  y: 25,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{
                  once: true,
                  amount: 0.1,
                }}
                transition={{
                  duration: 0.45,
                  ease: 'easeOut',
                  delay: Math.min(
                    index * 0.05,
                    0.25
                  ),
                }}
                className={`
                  relative
                  flex
                  min-h-[180px]
                  w-full
                  items-center
                  ${
                    isLeft
                      ? 'md:justify-start'
                      : 'md:justify-end'
                  }
                `}
              >

                {/* ==================================================
                    MOBILE STOP
                ================================================== */}

                <div
                  className={`
                    absolute
                    left-[9px]
                    top-1/2
                    z-30
                    flex
                    h-11
                    w-11
                    -translate-y-1/2
                    items-center
                    justify-center
                    rounded-full
                    border-4
                    border-white
                    text-sm
                    font-black
                    text-white
                    shadow-lg
                    dark:border-slate-900
                    md:hidden
                    ${style.marker}
                  `}
                >
                  {index + 1}
                </div>

                {/* ==================================================
                    DESKTOP STOP
                ================================================== */}

                <div
                  className={`
                    absolute
                    left-1/2
                    top-1/2
                    z-30
                    hidden
                    h-14
                    w-14
                    -translate-x-1/2
                    -translate-y-1/2
                    items-center
                    justify-center
                    rounded-full
                    border-4
                    border-white
                    text-base
                    font-black
                    text-white
                    shadow-xl
                    dark:border-slate-900
                    md:flex
                    ${style.marker}
                  `}
                >
                  {index + 1}
                </div>

                {/* ==================================================
                    CARD
                ================================================== */}

                <div
                  className={`
                    w-full
                    pl-[58px]
                    md:w-[47%]
                    md:pl-0
                    ${
                      isLeft
                        ? 'md:pr-8'
                        : 'md:pl-8'
                    }
                  `}
                >

                  <div
                    className={`
                      overflow-hidden
                      rounded-[26px]
                      border
                      bg-white
                      shadow-[0_16px_45px_-25px_rgba(15,23,42,0.5)]
                      transition-all
                      duration-300
                      hover:-translate-y-1
                      hover:shadow-[0_25px_55px_-25px_rgba(15,23,42,0.55)]
                      dark:bg-slate-800
                      ${style.border}
                    `}
                  >

                    {/* ==================================================
                        CARD HEADER
                    ================================================== */}

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPlaceId(
                          isExpanded
                            ? null
                            : place.id
                        )
                      }
                      className="
                        block
                        w-full
                        text-left
                        focus:outline-none
                        focus-visible:ring-2
                        focus-visible:ring-primary-500
                        focus-visible:ring-inset
                      "
                    >

                      <div className="
                        flex
                        items-center
                        gap-3
                        p-3
                        sm:gap-4
                        sm:p-4
                      ">

                        {/* ==================================================
                            PHOTO
                        ================================================== */}

                        <div className="
                          relative
                          h-[82px]
                          w-[82px]
                          shrink-0
                          overflow-hidden
                          rounded-2xl
                          border
                          border-slate-200
                          bg-slate-100
                          dark:border-slate-700
                          dark:bg-slate-700
                          sm:h-[125px]
                          sm:w-[125px]
                          lg:h-[135px]
                          lg:w-[135px]
                        ">

                          {hasPhoto ? (
                            <img
                              src={place.photo_url}
                              alt={place.name || 'Visited place'}
                              loading="lazy"
                              className="
                                h-full
                                w-full
                                object-cover
                                transition-transform
                                duration-500
                                hover:scale-105
                              "
                            />
                          ) : (
                            <div className="
                              flex
                              h-full
                              w-full
                              items-center
                              justify-center
                              text-slate-400
                              dark:text-slate-500
                            ">
                              <FaImage className="h-7 w-7" />
                            </div>
                          )}

                          <div className="
                            pointer-events-none
                            absolute
                            inset-0
                            bg-gradient-to-t
                            from-black/25
                            via-transparent
                            to-transparent
                          " />

                        </div>

                        {/* ==================================================
                            CONTENT
                        ================================================== */}

                        <div className="min-w-0 flex-1">

                          <div className="
                            mb-2
                            flex
                            items-start
                            justify-between
                            gap-2
                          ">

                            <h3 className="
                              line-clamp-2
                              text-[15px]
                              font-extrabold
                              leading-5
                              text-slate-900
                              dark:text-white
                              sm:text-lg
                              sm:leading-6
                              lg:text-xl
                            ">
                              {place.name || 'Unnamed place'}
                            </h3>

                            <span
                              className={`
                                shrink-0
                                rounded-full
                                px-2
                                py-1
                                text-[9px]
                                font-extrabold
                                tracking-wide
                                ${style.badge}
                              `}
                            >
                              STOP {index + 1}
                            </span>

                          </div>

                          {/* LOCATION */}

                          {place.location && (
                            <div className="
                              mb-1.5
                              flex
                              min-w-0
                              items-center
                              gap-1.5
                              text-[10px]
                              text-slate-500
                              dark:text-slate-400
                              sm:text-[11px]
                            ">

                              <FaMapMarkerAlt className="
                                h-2.5
                                w-2.5
                                shrink-0
                                text-primary-500
                              " />

                              <span className="truncate">
                                {place.location}
                              </span>

                            </div>
                          )}

                          {/* DATE */}

                          {place.visited_time && (
                            <div className="
                              mb-1.5
                              flex
                              items-center
                              gap-1.5
                              text-[10px]
                              text-slate-500
                              dark:text-slate-400
                              sm:text-[11px]
                            ">

                              <FaCalendarAlt className="
                                h-2.5
                                w-2.5
                                shrink-0
                              " />

                              <span>
                                {formatDate(
                                  place.visited_time
                                )}
                              </span>

                            </div>
                          )}

                          {/* USER */}

                          {place.created_by && (
                            <div className="
                              flex
                              min-w-0
                              items-center
                              gap-1.5
                              text-[10px]
                              text-slate-500
                              dark:text-slate-400
                              sm:text-[11px]
                            ">

                              <FaUser className="
                                h-2.5
                                w-2.5
                                shrink-0
                              " />

                              <span className="truncate">
                                {place.created_by}
                              </span>

                            </div>
                          )}

                          {/* DESCRIPTION */}

                          {place.description && (
                            <p className="
                              mt-2
                              line-clamp-2
                              text-[11px]
                              leading-5
                              text-slate-600
                              dark:text-slate-300
                              sm:text-xs
                            ">
                              {place.description}
                            </p>
                          )}

                        </div>

                        {/* CHEVRON */}

                        <div className="
                          hidden
                          h-8
                          w-8
                          shrink-0
                          items-center
                          justify-center
                          rounded-full
                          bg-slate-100
                          text-slate-500
                          sm:flex
                          dark:bg-slate-700
                          dark:text-slate-300
                        ">

                          <FaChevronDown
                            className={`
                              h-3
                              w-3
                              transition-transform
                              duration-200
                              ${
                                isExpanded
                                  ? 'rotate-180'
                                  : ''
                              }
                            `}
                          />

                        </div>

                      </div>

                    </button>

                    {/* ==================================================
                        EXPANDED CONTENT
                    ================================================== */}

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
                            duration: 0.25,
                            ease: 'easeOut',
                          }}
                          className="overflow-hidden"
                        >

                          <div className="
                            border-t
                            border-slate-200
                            bg-slate-50
                            p-3
                            dark:border-slate-700
                            dark:bg-slate-900/50
                            sm:p-4
                          ">

                            {/* LARGE IMAGE */}

                            {hasPhoto && (
                              <img
                                src={place.photo_url}
                                alt={place.name || 'Visited place'}
                                loading="lazy"
                                className="
                                  mb-4
                                  h-44
                                  w-full
                                  rounded-2xl
                                  object-cover
                                  shadow-sm
                                  sm:h-56
                                "
                              />
                            )}

                            {/* LOCATION */}

                            {place.location && (
                              <div className="
                                mb-3
                                inline-flex
                                max-w-full
                                items-center
                                gap-1.5
                                rounded-full
                                bg-white
                                px-3
                                py-1.5
                                text-[11px]
                                font-semibold
                                text-slate-700
                                shadow-sm
                                dark:bg-slate-800
                                dark:text-slate-200
                              ">

                                <FaMapMarkerAlt className="
                                  h-3
                                  w-3
                                  shrink-0
                                  text-primary-500
                                " />

                                <span className="truncate">
                                  {place.location}
                                </span>

                              </div>
                            )}

                            {/* DESCRIPTION */}

                            {place.description && (
                              <p className="
                                text-sm
                                leading-6
                                text-slate-600
                                dark:text-slate-300
                              ">
                                {place.description}
                              </p>
                            )}

                            {/* FOOTER */}

                            <div className="
                              mt-4
                              flex
                              flex-wrap
                              items-center
                              justify-between
                              gap-3
                              border-t
                              border-slate-200
                              pt-3
                              dark:border-slate-700
                            ">

                              {place.visited_time ? (
                                <div className="
                                  flex
                                  items-center
                                  gap-1.5
                                  text-[11px]
                                  text-slate-500
                                  dark:text-slate-400
                                ">

                                  <FaCalendarAlt className="h-2.5 w-2.5" />

                                  {formatDate(
                                    place.visited_time,
                                    true
                                  )}

                                </div>
                              ) : (
                                <span />
                              )}

                              {/* DELETE */}

                              {currentUsername &&
                                currentUsername ===
                                  place.created_by && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();

                                      handleDelete(
                                        place.id
                                      );
                                    }}
                                    className="
                                      inline-flex
                                      items-center
                                      gap-1.5
                                      rounded-lg
                                      px-2.5
                                      py-1.5
                                      text-[11px]
                                      font-semibold
                                      text-red-500
                                      transition-colors
                                      hover:bg-red-50
                                      hover:text-red-600
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

                        </motion.div>
                      )}

                    </AnimatePresence>

                  </div>

                </div>

              </motion.div>
            );
          })}

        </div>

      </div>

      {/* ======================================================
          MODAL
      ====================================================== */}

      <AddPlaceModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={loadPlaces}
        tripId={tripId}
      />

    </div>
  );
};

export default PlacesTab;