// src/components/trips/AddPlaceModal.js

import React, {
  useState,
  useRef,
  useEffect
} from 'react';

import {
  motion,
  AnimatePresence
} from 'framer-motion';

import {
  FaTimes,
  FaCamera,
  FaImage,
  FaSyncAlt
} from 'react-icons/fa';

import toast from 'react-hot-toast';

import { placesAPI } from '../../services/api';


const AddPlaceModal = ({
  isOpen,
  onClose,
  onSuccess,
  tripId
}) => {

  // -----------------------------------------
  // FORM STATE
  // -----------------------------------------

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: ''
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');

  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  // Camera / Gallery menu
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);

  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Front / rear camera
  const [facingMode, setFacingMode] = useState('environment');


  // -----------------------------------------
  // REFS
  // -----------------------------------------

  const uploadInputRef = useRef(null);

  const videoRef = useRef(null);

  const streamRef = useRef(null);


  // -----------------------------------------
  // CLEAN CAMERA STREAM
  // -----------------------------------------

  const stopCamera = () => {

    if (streamRef.current) {

      streamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
    setCameraLoading(false);
  };


  // -----------------------------------------
  // START CAMERA
  // -----------------------------------------

  const startCamera = async () => {

    // Close Camera/Gallery menu
    setShowPhotoMenu(false);

    // Clear previous error
    setCameraError('');

    setCameraLoading(true);

    setCameraOpen(true);


    try {

      // Stop previous stream if any
      if (streamRef.current) {

        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }


      // Check browser support
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {

        throw new Error(
          'Camera is not supported by this browser.'
        );
      }


      // Request camera
      const stream =
        await navigator.mediaDevices.getUserMedia({

          video: {
            facingMode: {
              ideal: facingMode
            },

            width: {
              ideal: 1280
            },

            height: {
              ideal: 720
            }
          },

          audio: false

        });


      streamRef.current = stream;


      // Attach stream to video
      if (videoRef.current) {

        videoRef.current.srcObject = stream;

        await videoRef.current.play();
      }

      setCameraLoading(false);

    } catch (error) {

      console.error(
        'Camera error:',
        error
      );

      setCameraLoading(false);

      setCameraError(
        getCameraErrorMessage(error)
      );
    }
  };


  // -----------------------------------------
  // CAMERA ERROR MESSAGE
  // -----------------------------------------

  const getCameraErrorMessage = (error) => {

    if (!error) {
      return 'Unable to access camera.';
    }


    if (error.name === 'NotAllowedError') {

      return (
        'Camera permission was denied. ' +
        'Please allow camera access in your browser settings.'
      );
    }


    if (error.name === 'NotFoundError') {

      return (
        'No camera was found on this device.'
      );
    }


    if (error.name === 'NotReadableError') {

      return (
        'Camera is already being used by another application.'
      );
    }


    if (error.name === 'SecurityError') {

      return (
        'Camera access requires a secure connection.'
      );
    }


    return (
      error.message ||
      'Unable to access camera.'
    );
  };


  // -----------------------------------------
  // SWITCH CAMERA
  // -----------------------------------------

  const switchCamera = async () => {

    const newFacingMode =
      facingMode === 'environment'
        ? 'user'
        : 'environment';

    setFacingMode(newFacingMode);

    // Restart camera with new direction
    setTimeout(() => {
      startCamera();
    }, 100);
  };


  // -----------------------------------------
  // TAKE PHOTO
  // -----------------------------------------

  const takePhoto = () => {

    const video = videoRef.current;

    if (!video) {
      return;
    }


    if (
      video.readyState <
      HTMLMediaElement.HAVE_CURRENT_DATA
    ) {

      toast.error(
        'Camera is not ready yet.'
      );

      return;
    }


    const canvas =
      document.createElement('canvas');


    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;


    const context =
      canvas.getContext('2d');


    if (!context) {
      toast.error(
        'Unable to capture photo.'
      );

      return;
    }


    // Draw current camera frame
    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );


    // Convert to image
    canvas.toBlob(
      (blob) => {

        if (!blob) {

          toast.error(
            'Failed to capture photo.'
          );

          return;
        }


        const file = new File(
          [blob],
          `place-${Date.now()}.jpg`,
          {
            type: 'image/jpeg'
          }
        );


        handlePhotoSelection(file);

        stopCamera();

      },

      'image/jpeg',

      0.92
    );
  };


  // -----------------------------------------
  // PHOTO SELECTION
  // -----------------------------------------

  const handlePhotoSelection = (
    file
  ) => {

    if (!file) {
      return;
    }


    if (
      !file.type ||
      !file.type.startsWith('image/')
    ) {

      toast.error(
        'Please select a valid image file.'
      );

      return;
    }


    // Remove old object URL
    if (photoPreview) {

      URL.revokeObjectURL(
        photoPreview
      );
    }


    // Store photo
    setPhotoFile(file);


    // Create preview
    const preview =
      URL.createObjectURL(file);

    setPhotoPreview(preview);


    // Close menu
    setShowPhotoMenu(false);

    toast.success(
      'Photo selected.'
    );
  };


  // -----------------------------------------
  // OPEN GALLERY
  // -----------------------------------------

  const openGallery = () => {

    setShowPhotoMenu(false);

    uploadInputRef.current?.click();
  };


  // -----------------------------------------
  // REMOVE PHOTO
  // -----------------------------------------

  const removePhoto = () => {

    if (photoPreview) {

      URL.revokeObjectURL(
        photoPreview
      );
    }

    setPhotoPreview('');
    setPhotoFile(null);
  };


  // -----------------------------------------
  // LOCATION
  // -----------------------------------------

  const getCurrentLocation = () => {

    if (
      !('geolocation' in navigator)
    ) {

      toast.error(
        'Geolocation is not supported by this browser.'
      );

      return;
    }


    setLocating(true);


    navigator.geolocation.getCurrentPosition(

      async (pos) => {

        const {
          latitude,
          longitude
        } = pos.coords;


        try {

          const response =
            await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
            );


          const data =
            await response.json();


          const display =
            data?.display_name ||
            `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;


          setFormData((prev) => ({
            ...prev,
            location: display
          }));


          toast.success(
            'Location captured.'
          );

        } catch (error) {

          setFormData((prev) => ({
            ...prev,
            location:
              `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          }));

        } finally {

          setLocating(false);
        }
      },


      (error) => {

        setLocating(false);


        if (error.code === 1) {

          toast.error(
            'Location permission denied.'
          );

        } else if (error.code === 2) {

          toast.error(
            'Unable to determine location.'
          );

        } else if (error.code === 3) {

          toast.error(
            'Location request timed out.'
          );

        } else {

          toast.error(
            'Failed to get location.'
          );
        }
      },


      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };


  // -----------------------------------------
  // SUBMIT
  // -----------------------------------------

  const handleSubmit = async (e) => {

    e.preventDefault();


    if (!formData.name.trim()) {

      toast.error(
        'Please enter a place name.'
      );

      return;
    }


    setLoading(true);


    try {

      const data = {

        trip_id: tripId,

        name:
          formData.name.trim(),

        description:
          formData.description.trim() ||
          null,

        location:
          formData.location.trim() ||
          null
      };


      await placesAPI.add(
        data,
        photoFile
      );


      toast.success(
        'Place added successfully!'
      );


      // Reset form
      setFormData({
        name: '',
        description: '',
        location: ''
      });


      removePhoto();


      setShowPhotoMenu(false);


      onSuccess();


    } catch (error) {

      console.error(
        'Add place error:',
        error
      );


      toast.error(
        error?.response?.data?.error ||
        'Failed to add place.'
      );


    } finally {

      setLoading(false);
    }
  };


  // -----------------------------------------
  // CLOSE MODAL
  // -----------------------------------------

  const handleClose = () => {

    stopCamera();

    setShowPhotoMenu(false);

    onClose();
  };


  // -----------------------------------------
  // CLEANUP
  // -----------------------------------------

  useEffect(() => {

    return () => {

      if (streamRef.current) {

        streamRef.current
          .getTracks()
          .forEach((track) => {
            track.stop();
          });
      }


      if (photoPreview) {

        URL.revokeObjectURL(
          photoPreview
        );
      }
    };

  }, [photoPreview]);


  // -----------------------------------------
  // UI
  // -----------------------------------------

  return (

    <AnimatePresence>

      {isOpen && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/50
            p-3
            sm:p-4
          "
        >

          <motion.div

            initial={{
              opacity: 0,
              scale: 0.95
            }}

            animate={{
              opacity: 1,
              scale: 1
            }}

            exit={{
              opacity: 0,
              scale: 0.95
            }}

            className="
              relative
              w-full
              max-w-md
              max-h-[92vh]
              overflow-y-auto
              rounded-2xl
              bg-white
              p-4
              shadow-2xl
              sm:p-6
              dark:bg-gray-800
            "
          >


            {/* -------------------------------- */}
            {/* HEADER */}
            {/* -------------------------------- */}

            <div
              className="
                mb-4
                flex
                items-center
                justify-between
              "
            >

              <h2
                className="
                  text-lg
                  font-bold
                  text-gray-900
                  sm:text-xl
                  dark:text-white
                "
              >
                Add Place
              </h2>


              <button

                type="button"

                onClick={handleClose}

                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-full
                  text-gray-400
                  transition
                  hover:bg-gray-100
                  hover:text-gray-700
                  dark:hover:bg-gray-700
                "
              >

                <FaTimes />

              </button>

            </div>


            {/* -------------------------------- */}
            {/* FORM */}
            {/* -------------------------------- */}

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >


              {/* NAME */}

              <div>

                <label
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                    text-gray-700
                    dark:text-gray-300
                  "
                >
                  Place Name *
                </label>


                <input

                  type="text"

                  required

                  value={formData.name}

                  onChange={(e) =>
                    setFormData(
                      (prev) => ({
                        ...prev,
                        name: e.target.value
                      })
                    )
                  }

                  className="
                    input-field
                    w-full
                  "

                  placeholder="Enter place name"
                />

              </div>


              {/* DESCRIPTION */}

              <div>

                <label
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                    text-gray-700
                    dark:text-gray-300
                  "
                >
                  Description
                </label>


                <textarea

                  value={
                    formData.description
                  }

                  onChange={(e) =>
                    setFormData(
                      (prev) => ({
                        ...prev,
                        description:
                          e.target.value
                      })
                    )
                  }

                  className="
                    input-field
                    w-full
                  "

                  rows={3}

                  placeholder="Enter description"
                />

              </div>


              {/* LOCATION */}

              <div>

                <label
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                    text-gray-700
                    dark:text-gray-300
                  "
                >
                  Location
                </label>


                <div
                  className="
                    flex
                    flex-col
                    gap-2
                    sm:flex-row
                  "
                >

                  <input

                    type="text"

                    value={
                      formData.location
                    }

                    onChange={(e) =>
                      setFormData(
                        (prev) => ({
                          ...prev,
                          location:
                            e.target.value
                        })
                      )
                    }

                    className="
                      input-field
                      min-w-0
                      flex-1
                    "

                    placeholder="e.g., Marine Drive, Mumbai"
                  />


                  <button

                    type="button"

                    onClick={
                      getCurrentLocation
                    }

                    disabled={locating}

                    className="
                      btn-secondary
                      whitespace-nowrap
                    "
                  >

                    {locating
                      ? 'Getting…'
                      : 'Use current'}

                  </button>

                </div>

              </div>


              {/* -------------------------------- */}
              {/* PHOTO */}
              {/* -------------------------------- */}

              <div>

                <label
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                    text-gray-700
                    dark:text-gray-300
                  "
                >
                  Photo
                </label>


                <div
                  className="
                    flex
                    flex-wrap
                    items-center
                    gap-3
                  "
                >


                  {/* CAMERA ICON */}

                  <div
                    className="
                      relative
                      shrink-0
                    "
                  >

                    <button

                      type="button"

                      onClick={() =>
                        setShowPhotoMenu(
                          (prev) => !prev
                        )
                      }

                      className="
                        flex
                        h-12
                        w-12
                        items-center
                        justify-center
                        rounded-full
                        bg-primary-600
                        text-white
                        shadow-lg
                        transition
                        hover:bg-primary-700
                        active:scale-95
                        sm:h-14
                        sm:w-14
                      "

                      aria-label="Photo options"
                    >

                      <FaCamera
                        className="
                          h-5
                          w-5
                        "
                      />

                    </button>


                    {/* -------------------------------- */}
                    {/* CAMERA / GALLERY MENU */}
                    {/* -------------------------------- */}

                    {showPhotoMenu && (

                      <div
                        className="
                          absolute
                          bottom-full
                          left-0
                          z-[100]
                          mb-2
                          w-48
                          overflow-hidden
                          rounded-xl
                          border
                          border-gray-200
                          bg-white
                          shadow-2xl
                          dark:border-gray-700
                          dark:bg-gray-800
                          sm:left-0
                        "
                      >

                        {/* CAMERA */}

                        <button

                          type="button"

                          onClick={
                            startCamera
                          }

                          className="
                            flex
                            w-full
                            items-center
                            gap-3
                            px-4
                            py-3
                            text-left
                            text-sm
                            font-medium
                            text-gray-700
                            transition
                            hover:bg-gray-100
                            dark:text-gray-200
                            dark:hover:bg-gray-700
                          "
                        >

                          <FaCamera
                            className="
                              h-4
                              w-4
                            "
                          />

                          <span>
                            Camera
                          </span>

                        </button>


                        {/* GALLERY */}

                        <button

                          type="button"

                          onClick={
                            openGallery
                          }

                          className="
                            flex
                            w-full
                            items-center
                            gap-3
                            px-4
                            py-3
                            text-left
                            text-sm
                            font-medium
                            text-gray-700
                            transition
                            hover:bg-gray-100
                            dark:text-gray-200
                            dark:hover:bg-gray-700
                          "
                        >

                          <FaImage
                            className="
                              h-4
                              w-4
                            "
                          />

                          <span>
                            Gallery
                          </span>

                        </button>

                      </div>
                    )}

                  </div>


                  {/* -------------------------------- */}
                  {/* GALLERY INPUT ONLY */}
                  {/* -------------------------------- */}

                  <input

                    ref={
                      uploadInputRef
                    }

                    type="file"

                    accept="image/*"

                    onChange={(e) =>
                      handlePhotoSelection(
                        e.target.files?.[0]
                      )
                    }

                    className="hidden"
                  />


                  {/* -------------------------------- */}
                  {/* PHOTO PREVIEW */}
                  {/* -------------------------------- */}

                  {photoPreview ? (

                    <div
                      className="
                        relative
                        h-16
                        w-16
                        shrink-0
                        overflow-hidden
                        rounded-xl
                        border
                        border-gray-200
                        shadow-sm
                        dark:border-gray-700
                      "
                    >

                      <img

                        src={
                          photoPreview
                        }

                        alt="Selected place"

                        className="
                          h-full
                          w-full
                          object-cover
                        "
                      />


                      <button

                        type="button"

                        onClick={
                          removePhoto
                        }

                        className="
                          absolute
                          right-1
                          top-1
                          flex
                          h-5
                          w-5
                          items-center
                          justify-center
                          rounded-full
                          bg-black/70
                          text-xs
                          text-white
                        "
                      >

                        <FaTimes />

                      </button>

                    </div>

                  ) : (

                    <div
                      className="
                        flex
                        h-16
                        w-16
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-dashed
                        border-gray-300
                        bg-gray-50
                        text-gray-400
                        dark:border-gray-600
                        dark:bg-gray-700
                      "
                    >

                      <FaImage
                        className="
                          h-5
                          w-5
                        "
                      />

                    </div>

                  )}

                </div>

              </div>


              {/* -------------------------------- */}
              {/* ACTION BUTTONS */}
              {/* -------------------------------- */}

              <div
                className="
                  flex
                  gap-2
                  pt-2
                "
              >

                <button

                  type="button"

                  onClick={
                    handleClose
                  }

                  disabled={loading}

                  className="
                    btn-secondary
                    flex-1
                  "
                >
                  Cancel
                </button>


                <button

                  type="submit"

                  disabled={loading}

                  className="
                    btn-primary
                    flex-1
                  "
                >

                  {loading
                    ? 'Adding...'
                    : 'Add Place'}

                </button>

              </div>

            </form>

          </motion.div>

        </div>
      )}


      {/* ======================================== */}
      {/* CAMERA SCREEN */}
      {/* ======================================== */}

      {cameraOpen && (

        <div
          className="
            fixed
            inset-0
            z-[200]
            flex
            flex-col
            bg-black
          "
        >

          {/* CAMERA HEADER */}

          <div
            className="
              flex
              items-center
              justify-between
              px-4
              py-4
              text-white
            "
          >

            <button

              type="button"

              onClick={
                stopCamera
              }

              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-full
                bg-white/10
                backdrop-blur
                transition
                hover:bg-white/20
              "
            >

              <FaTimes />

            </button>


            <span
              className="
                text-sm
                font-semibold
              "
            >
              Camera
            </span>


            {/* SWITCH CAMERA */}

            <button

              type="button"

              onClick={
                switchCamera
              }

              disabled={
                cameraLoading
              }

              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-full
                bg-white/10
                backdrop-blur
                transition
                hover:bg-white/20
              "
            >

              <FaSyncAlt />

            </button>

          </div>


          {/* CAMERA VIEW */}

          <div
            className="
              relative
              flex
              min-h-0
              flex-1
              items-center
              justify-center
              overflow-hidden
            "
          >

            {cameraError ? (

              <div
                className="
                  max-w-sm
                  px-6
                  text-center
                  text-white
                "
              >

                <FaCamera
                  className="
                    mx-auto
                    mb-4
                    h-12
                    w-12
                    opacity-60
                  "
                />

                <p
                  className="
                    mb-4
                    text-sm
                    leading-6
                  "
                >
                  {cameraError}
                </p>


                <button

                  type="button"

                  onClick={
                    startCamera
                  }

                  className="
                    rounded-xl
                    bg-white
                    px-5
                    py-3
                    text-sm
                    font-semibold
                    text-black
                  "
                >
                  Try Again
                </button>

              </div>

            ) : (

              <video

                ref={
                  videoRef
                }

                autoPlay

                playsInline

                muted

                className="
                  h-full
                  w-full
                  object-cover
                "
              />

            )}


            {/* LOADING */}

            {cameraLoading && (

              <div
                className="
                  absolute
                  inset-0
                  flex
                  items-center
                  justify-center
                  bg-black/40
                  text-white
                "
              >

                <div
                  className="
                    text-center
                  "
                >

                  <div
                    className="
                      mx-auto
                      mb-3
                      h-10
                      w-10
                      animate-spin
                      rounded-full
                      border-4
                      border-white/30
                      border-t-white
                    "
                  />

                  <p
                    className="
                      text-sm
                    "
                  >
                    Starting camera...
                  </p>

                </div>

              </div>

            )}

          </div>


          {/* CAMERA CONTROLS */}

          {!cameraError && (

            <div
              className="
                flex
                items-center
                justify-center
                px-4
                py-7
              "
            >

              <button

                type="button"

                onClick={
                  takePhoto
                }

                disabled={
                  cameraLoading
                }

                className="
                  flex
                  h-20
                  w-20
                  items-center
                  justify-center
                  rounded-full
                  border-4
                  border-white
                  bg-white
                  shadow-2xl
                  transition
                  active:scale-90
                  disabled:opacity-50
                  sm:h-24
                  sm:w-24
                "
                aria-label="Take photo"
              >

                <div
                  className="
                    h-16
                    w-16
                    rounded-full
                    bg-white
                    ring-2
                    ring-black/20
                    sm:h-20
                    sm:w-20
                  "
                />

              </button>

            </div>

          )}

        </div>
      )}

    </AnimatePresence>
  );
};


// Support BOTH import styles.

export {
  AddPlaceModal
};

export default AddPlaceModal;