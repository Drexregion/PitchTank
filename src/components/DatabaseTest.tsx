import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';

export const DatabaseTest: React.FC = () => {
  const { user } = useAuth();
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const testDatabaseConnection = async () => {
    setIsLoading(true);
    setTestResult('Testing...');
    
    try {
      // Test 1: Check if user is authenticated
      if (!user) {
        setTestResult('❌ User not authenticated');
        return;
      }
      
      setTestResult(`✅ User authenticated: ${user.email}\n`);

      // Test 2: Get a real event ID first
      setTestResult(prev => prev + '🔄 Fetching available events...\n');
      
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, name')
        .limit(1);

      if (eventsError) {
        setTestResult(prev => prev + `❌ Failed to fetch events: ${eventsError.message}\n`);
        return;
      }

      if (!events || events.length === 0) {
        setTestResult(prev => prev + `❌ No events found. Please create an event first.\n`);
        return;
      }

      const eventId = events[0].id;
      setTestResult(prev => prev + `✅ Found event: ${events[0].name} (${eventId})\n`);

      // Test 3: Try to insert a test invitation with real event ID
      const testInvitation = {
        email: 'test@example.com',
        event_id: eventId, // Use real event ID
        invitation_token: crypto.randomUUID(),
        status: 'sent' as const,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        invited_by: user.id
      };

      setTestResult(prev => prev + '🔄 Attempting to insert test invitation...\n');

      const { data, error } = await supabase
        .from('founder_invitations')
        .insert(testInvitation)
        .select();

      if (error) {
        setTestResult(prev => prev + `❌ Insert failed: ${error.message}\n`);
        setTestResult(prev => prev + `Error details: ${JSON.stringify(error, null, 2)}\n`);
      } else {
        setTestResult(prev => prev + `✅ Insert successful!\n`);
        setTestResult(prev => prev + `Created record: ${JSON.stringify(data, null, 2)}\n`);
      }

      // Test 4: Try to read invitations
      setTestResult(prev => prev + '🔄 Testing read permissions...\n');
      
      const { data: readData, error: readError } = await supabase
        .from('founder_invitations')
        .select('*')
        .limit(5);

      if (readError) {
        setTestResult(prev => prev + `❌ Read failed: ${readError.message}\n`);
      } else {
        setTestResult(prev => prev + `✅ Read successful! Found ${readData?.length || 0} records\n`);
      }

      // Test 5: Try to read events
      setTestResult(prev => prev + '🔄 Testing events read permissions...\n');
      
      const { data: eventsData, error: eventsReadError } = await supabase
        .from('events')
        .select('*')
        .limit(5);

      if (eventsReadError) {
        setTestResult(prev => prev + `❌ Events read failed: ${eventsReadError.message}\n`);
      } else {
        setTestResult(prev => prev + `✅ Events read successful! Found ${eventsData?.length || 0} events\n`);
        if (eventsData && eventsData.length > 0) {
          setTestResult(prev => prev + `Events: ${eventsData.map(e => e.name).join(', ')}\n`);
        }
      }

    } catch (err: any) {
      setTestResult(prev => prev + `❌ Exception: ${err.message}\n`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold mb-4">Database Connection Test</h3>
      
      <button
        onClick={testDatabaseConnection}
        disabled={isLoading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Testing...' : 'Test Database Connection'}
      </button>

      {testResult && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
        </div>
      )}
    </div>
  );
};
