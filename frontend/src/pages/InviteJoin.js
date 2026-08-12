// src/pages/InviteJoin.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { groupsAPI } from '../services/api';
export const InviteJoin = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(true);

  useEffect(() => {
    const join = async () => {
      try {
        setJoining(true);
        if (!localStorage.getItem('token')) {
          // not authenticated, store token and redirect to register with nickname prefill
          localStorage.setItem('pendingInviteToken', token);
          const nickname = new URLSearchParams(window.location.search).get('nickname') || '';
          if (nickname) localStorage.setItem('pendingInviteNickname', nickname);
          navigate('/register');
          return;
        }
        const res = await groupsAPI.joinByInvite(token);
        toast.success(res.data?.message || 'Joined group');
        navigate('/dashboard');
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to join via invite');
        navigate('/dashboard');
      } finally {
        setJoining(false);
      }
    };
    join();
  }, [token, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          {joining ? 'Joining group…' : 'Redirecting…'}
        </p>
      </div>
    </div>
  );
};


