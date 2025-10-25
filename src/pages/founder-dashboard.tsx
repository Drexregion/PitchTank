import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Navbar } from '../components/Navbar';
import { FounderProfilePage } from '../components/FounderProfilePage';
import { FounderProjectManager } from '../components/FounderProjectManager';
import { useAuth } from '../hooks/useAuth';
import { useFounderUser } from '../hooks/useFounderUser';
import { Event } from '../types/Event';
// import { Founder } from '../types/Founder';

const FounderDashboardPage: React.FC = () => {
  const { user, isFounder, founderUser, isLoading: authLoading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'projects'>('profile');

  // Get founder user data and projects
  const {
    founderUser: founderUserData,
    founderProjects,
    isLoading: founderLoading,
    error: founderError,
    updateProfile,
    refreshData
  } = useFounderUser({ founderUserId: founderUser?.id });

  // Fetch events for project creation
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        setEvents(data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch events');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Redirect if not authenticated or not a founder
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isFounder || !founderUser) {
    return <Navigate to="/founder-login" replace />;
  }

  if (founderLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading founder data...</p>
        </div>
      </div>
    );
  }


  if (founderError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">Error: {founderError}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!founderUserData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-600 mb-4">Founder profile not found</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {founderUserData.first_name}!
          </h1>
          <p className="text-gray-600">
            Manage your profile and projects
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Profile Settings
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'projects'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              My Projects ({founderProjects.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="max-w-4xl">
          {activeTab === 'profile' && (
            <FounderProfilePage
              founderUser={founderUserData}
              founderProjects={founderProjects}
              isLoading={founderLoading}
              error={founderError}
              onUpdateProfile={updateProfile}
            />
          )}

          {activeTab === 'projects' && (
            <div className="space-y-6">
              <FounderProjectManager
                founderUserId={founderUserData.id}
                events={events}
                existingProjects={founderProjects}
                onProjectCreated={refreshData}
                onProjectUpdated={refreshData}
              />
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default FounderDashboardPage;
