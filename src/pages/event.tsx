import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Navbar } from '../components/Navbar';
import { FounderStockCard } from '../components/FounderStockCard';
import { Leaderboard } from '../components/Leaderboard';
import { useAuth } from '../hooks/useAuth';
import { Event } from '../types/Event';
import { FounderWithPrice } from '../types/Founder';
import { calculateCurrentPrice, calculateMarketCap } from '../lib/ammEngine';

const EventPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  console.log(eventId)
  const [event, setEvent] = useState<Event | null>(null);
  const [founders, setFounders] = useState<FounderWithPrice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!eventId) {
        setError('No event ID provided');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch event details
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();
          
        if (eventError) throw eventError;
        setEvent(eventData);
        
        // Fetch founders for this event
        const { data: foundersData, error: foundersError } = await supabase
          .from('founders')
          .select('*')
          .eq('event_id', eventId);
          
        if (foundersError) throw foundersError;
        
        // Calculate current price and market cap for each founder
        const foundersWithPrice: FounderWithPrice[] = foundersData.map(founder => ({
          ...founder,
          current_price: calculateCurrentPrice(founder),
          market_cap: calculateMarketCap(founder)
        }));
        
        // Sort by market cap (highest first)
        foundersWithPrice.sort((a, b) => b.market_cap - a.market_cap);
        
        setFounders(foundersWithPrice);
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load event details');
        setIsLoading(false);
      }
    };
    
    fetchEventDetails();
    
    // Set up realtime subscription for founders updates
    if (eventId) {
      const foundersChannel = supabase
        .channel(`founders_event_${eventId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'founders',
          filter: `event_id=eq.${eventId}`
        }, async () => {
          // Refetch founders when there's an update
          const { data: foundersData } = await supabase
            .from('founders')
            .select('*')
            .eq('event_id', eventId);
            
          if (foundersData) {
            const updated = foundersData.map(founder => ({
              ...founder,
              current_price: calculateCurrentPrice(founder),
              market_cap: calculateMarketCap(founder)
            }));
            
            // Sort by market cap (highest first)
            updated.sort((a, b) => b.market_cap - a.market_cap);
            
            setFounders(updated);
          }
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(foundersChannel);
      };
    }
  }, [eventId]);
  
  // Format date for display
  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Check if event is currently active
  const isEventActive = (event: Event) => {
    const now = new Date();
    const startTime = new Date(event.start_time);
    const endTime = new Date(event.end_time);
    return now >= startTime && now <= endTime && event.status === 'active';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="text-lg text-gray-600">Loading event details...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
            {error}
          </div>
        ) : !event ? (
          <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg mb-4">
            Event not found.
          </div>
        ) : (
          <>
            {/* Event Header */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
                  {event.description && (
                    <p className="text-gray-600 mb-4 max-w-2xl">{event.description}</p>
                  )}
                  <div className="flex items-center flex-wrap gap-2">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      event.status === 'active' ? 'bg-green-100 text-green-800' :
                      event.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      event.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                    </div>
                    
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">From:</span> {formatEventDate(event.start_time)}
                    </div>
                    
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">To:</span> {formatEventDate(event.end_time)}
                    </div>
                  </div>
                </div>
                
                {user && (
                  <div>
                    <Link
                      to={`/dashboard/4df0c0f1-307f-42fb-b319-a99de3b26aeb`}
                      className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                    >
                      Go to Dashboard
                    </Link>
                  </div>
                )}
              </div>
              
              {!isEventActive(event) && event.status === 'active' && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <p className="text-yellow-800">
                    <span className="font-medium">Note:</span> This event is scheduled but not currently active.
                    It will be active from {formatEventDate(event.start_time)} to {formatEventDate(event.end_time)}.
                  </p>
                </div>
              )}
              
              {event.status === 'draft' && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <p className="text-yellow-800">
                    <span className="font-medium">Note:</span> This event is currently in draft mode
                    and is only visible to administrators.
                  </p>
                </div>
              )}
              
              {event.status === 'completed' && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-blue-800">
                    <span className="font-medium">Note:</span> This event has ended.
                    Trading is no longer available but you can view the final results.
                  </p>
                </div>
              )}
              
              {event.status === 'cancelled' && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg">
                  <p className="text-red-800">
                    <span className="font-medium">Note:</span> This event has been cancelled.
                  </p>
                </div>
              )}
            </div>
            
            {/* Event Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content - Founders */}
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold mb-4">Founders</h2>
                
                {founders.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-8 text-center">
                    <p className="text-gray-600">No founders available for this event.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {founders.map(founder => (
                      <FounderStockCard 
                        key={founder.id}
                        founder={founder}
                        showPriceChart={true}
                      />
                    ))}
                  </div>
                )}
              </div>
              
              {/* Sidebar - Leaderboard */}
              <div>
                <Leaderboard eventId={eventId || ''} />
                
                <div className="mt-6 bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="p-5">
                    <h3 className="text-xl font-bold mb-4">Join the Event</h3>
                    <p className="text-gray-600 mb-4">
                      Want to participate? Sign in to get started with a virtual $1,000,000 balance
                      to invest in these founders.
                    </p>
                    
                    {!user ? (
                      <div className="flex space-x-4">
                        <Link
                          to="/login"
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                        >
                          Log In
                        </Link>
                        <Link
                          to="/signup"
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                        >
                          Sign Up
                        </Link>
                      </div>
                    ) : (
                      <Link
                        to={`/dashboard/${eventId}`}
                        className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                      >
                        Go to Dashboard
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EventPage;
