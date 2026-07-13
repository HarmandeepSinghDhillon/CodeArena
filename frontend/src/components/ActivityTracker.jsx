import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ActivityTracker() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if the user is logged in
    const token = localStorage.getItem('token');
    if (!token) return;

    const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes in milliseconds
    const now = Date.now();

    // Check if session has already expired since last activity
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity && now - parseInt(lastActivity, 10) > INACTIVITY_LIMIT) {
      handleLogout();
      return;
    }

    // Set initial activity timestamp if not present
    if (!lastActivity) {
      localStorage.setItem('lastActivity', now.toString());
    }

    let lastSaved = 0;
    const updateActivity = () => {
      const currentTime = Date.now();
      // Throttle localStorage updates to at most once every 2 seconds for performance
      if (currentTime - lastSaved > 2000) {
        localStorage.setItem('lastActivity', currentTime.toString());
        lastSaved = currentTime;
      }
    };

    // Track standard user interaction events
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    // Check for inactivity periodically (every 10 seconds)
    const interval = setInterval(() => {
      const lastActiveTime = localStorage.getItem('lastActivity');
      if (lastActiveTime && Date.now() - parseInt(lastActiveTime, 10) > INACTIVITY_LIMIT) {
        handleLogout();
      }
    }, 10000);

    async function handleLogout() {
      clearInterval(interval);
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      try {
        await fetch('/api/logout', { method: 'POST' });
      } catch (err) {
        console.error('Logout error during inactivity timeout:', err);
      }
      localStorage.clear();
      navigate('/', { replace: true });
    }

    return () => {
      clearInterval(interval);
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [location.pathname, navigate]);

  return null;
}
