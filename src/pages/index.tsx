import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Navbar } from '../components/Navbar';
import { Event } from '../types/Event';
import { useAuth } from '../hooks/useAuth';

const HomePage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // const { user, isAdmin } = useAuth();
  const { isAdmin } = useAuth();
  
  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Query events, order by start_time (newest first)
        console.log("Fetching events...");
        const { data, error: fetchError } = await supabase
          .from('events')
          .select('*')
          .order('start_time', { ascending: false });
        console.log("Events fetched successfully");
        
        if (fetchError) throw fetchError;
        
        setEvents(data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch events');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEvents();
    
    // // Subscribe to realtime updates for events
    // const eventsSubscription = supabase
    //   .channel('events_changes')
    //   .on('postgres_changes', {
    //     event: '*',
    //     schema: 'public',
    //     table: 'events'
    //   }, () => {
    //     fetchEvents();
    //   })
    //   .subscribe();
      
    // return () => {
    //   supabase.removeChannel(eventsSubscription);
    // };
  }, []);
  
  // Get event status badge
  const getEventStatusBadge = (status: string) => {
    const statusClasses = {
      'active': 'bg-green-100 text-green-800',
      'completed': 'bg-blue-100 text-blue-800',
      'draft': 'bg-yellow-100 text-yellow-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status as keyof typeof statusClasses] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  // Format date for display
  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Pitch Tank Events</h1>
          {isAdmin && (
            <Link
              to="/admin/events/new"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Create Event
            </Link>
          )}
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="text-lg text-gray-600">Loading events...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">No Events Available</h2>
            <p className="text-gray-600">
              {isAdmin 
                ? 'Click the "Create Event" button to get started.' 
                : 'Check back later for upcoming events.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map(event => (
              <div key={event.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-bold mb-2 text-gray-900">
                      {event.name}
                    </h2>
                    {getEventStatusBadge(event.status)}
                  </div>
                  
                  {event.description && (
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                  
                  <div className="text-sm text-gray-500 mb-4">
                    <div>
                      <span className="font-medium">Starts:</span> {formatEventDate(event.start_time)}
                    </div>
                    <div>
                      <span className="font-medium">Ends:</span> {formatEventDate(event.end_time)}
                    </div>
                  </div>
                  
                  <Link
                    to={`/events/${event.id}`}
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                  >
                    View Event
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
