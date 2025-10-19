import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Navbar } from '../components/Navbar';
import { EventSetupForm } from '../components/EventSetupForm';
import { useAuth } from '../hooks/useAuth';
import { Event } from '../types/Event';

const AdminPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'new'>('list');
  const { user, isAdmin } = useAuth();
  
  // Fetch events managed by this admin
  useEffect(() => {
    if (!user || !isAdmin) {
      setIsLoading(false);
      return;
    }
    
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Query events
        const { data, error: fetchError } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (fetchError) throw fetchError;
        
        setEvents(data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch events');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEvents();
    
    // Subscribe to realtime updates
    const eventsSubscription = supabase
      .channel('admin_events_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events'
      }, () => {
        fetchEvents();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(eventsSubscription);
    };
  }, [user, isAdmin]);
  
  // If not admin, redirect to home
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Handle event creation
  const handleEventCreated = (newEvent: Event) => {
    setEvents([newEvent, ...events]);
    setActiveView('list');
  };
  
  // Handle status update
  const handleStatusUpdate = async (eventId: string, newStatus: string) => {
    try {
      const { error: updateError } = await supabase
        .from('events')
        .update({ status: newStatus })
        .eq('id', eventId);
      
      if (updateError) throw updateError;
    } catch (err: any) {
      setError(err.message || 'Failed to update event status');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div>
            {activeView === 'list' ? (
              <button
                onClick={() => setActiveView('new')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Create New Event
              </button>
            ) : (
              <button
                onClick={() => setActiveView('list')}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
              >
                Back to Events
              </button>
            )}
          </div>
        </div>
        
        {activeView === 'new' ? (
          <EventSetupForm onEventCreated={handleEventCreated} />
        ) : (
          <>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="text-lg text-gray-600">Loading events...</div>
              </div>
            ) : error ? (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
                {error}
              </div>
            ) : events.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <h2 className="text-xl font-semibold mb-2">No Events Created</h2>
                <p className="text-gray-600 mb-4">
                  Create your first event to get started.
                </p>
                <button
                  onClick={() => setActiveView('new')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Create Event
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Event
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {events.map(event => (
                      <tr key={event.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {event.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={event.status}
                            onChange={(e) => handleStatusUpdate(event.id, e.target.value)}
                            className={`text-sm font-medium px-2 py-1 rounded-full ${
                              event.status === 'active' ? 'bg-green-100 text-green-800' :
                              event.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                              event.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}
                          >
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(event.start_time)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(event.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            to={`/admin/events/${event.id}`}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Manage
                          </Link>
                          <Link
                            to={`/events/${event.id}`}
                            className="text-green-600 hover:text-green-900"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
