import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Event } from '../types/Event';
import { useAuth } from '../hooks/useAuth';

interface FounderInvitationManagerProps {
  events: Event[];
  onInvitationsSent?: () => void;
  className?: string;
}

export const FounderInvitationManager: React.FC<FounderInvitationManagerProps> = ({
  events,
  onInvitationsSent,
  className = ''
}) => {
  const { user } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [emailList, setEmailList] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdInvitations, setCreatedInvitations] = useState<Array<{email: string, token: string}>>([]);

  // Debug: Log available events
  console.log('Available events:', events);

  const handleSendInvitations = async () => {
    if (!selectedEventId) {
      setError('Please select an event');
      return;
    }

    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    console.log('Creating invitations for user:', user.id);
    console.log('Selected event:', selectedEventId);

    // Validate event ID format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(selectedEventId)) {
      setError('Invalid event ID format. Please select a valid event.');
      return;
    }

    if (!emailList.trim()) {
      setError('Please enter at least one email address');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);

      // Parse email list (comma or newline separated)
      const emails = emailList
        .split(/[,\n]/)
        .map(email => email.trim())
        .filter(email => email.length > 0);

      if (emails.length === 0) {
        setError('Please enter valid email addresses');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emails.filter(email => !emailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        setError(`Invalid email addresses: ${invalidEmails.join(', ')}`);
        return;
      }

      // Create invitation records directly in the database
      const invitations = emails.map(email => ({
        email: email.toLowerCase().trim(),
        event_id: selectedEventId,
        invitation_token: crypto.randomUUID(),
        status: 'sent' as const,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        invited_by: user.id
      }));

      console.log('Invitations to create:', invitations);

      const { data, error: insertError } = await supabase
        .from('founder_invitations')
        .insert(invitations)
        .select();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      if (!data || data.length === 0) {
        throw new Error('No invitations were created. Check database permissions.');
      }

      console.log('Successfully created invitations:', data);
      setSuccessMessage(`Successfully created ${data.length} invitation(s). Copy the links below to send via email.`);
      setCreatedInvitations(data.map(inv => ({ email: inv.email, token: inv.invitation_token })));
      setEmailList('');
      
      if (onInvitationsSent) {
        onInvitationsSent();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send invitations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      // Parse CSV content (simple implementation)
      const emails = content
        .split('\n')
        .map(line => line.split(',')[0].trim()) // Take first column
        .filter(email => email.length > 0 && email.includes('@'));
      
      setEmailList(emails.join('\n'));
    };
    reader.readAsText(file);
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h3 className="text-xl font-bold mb-4">Send Founder Invitations</h3>
      
      <div className="space-y-4">
        {/* Event Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Event
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Choose an event...</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </div>

        {/* Email Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Founder Email Addresses
          </label>
          <textarea
            value={emailList}
            onChange={(e) => setEmailList(e.target.value)}
            placeholder="Enter email addresses separated by commas or new lines&#10;example@founder.com, another@startup.com"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32 resize-none"
          />
          <p className="text-sm text-gray-500 mt-1">
            Separate multiple emails with commas or new lines
          </p>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Or Upload CSV File
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            CSV file with email addresses in the first column
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {successMessage}
          </div>
        )}

        {/* Created Invitation Links */}
        {createdInvitations.length > 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-3">Created Invitation Links:</h4>
            <div className="space-y-2">
              {createdInvitations.map((invitation, index) => (
                <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-700">{invitation.email}</span>
                    <div className="text-xs text-gray-500 mt-1">
                      {window.location.origin}/founder-signup/{invitation.token}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/founder-signup/${invitation.token}`);
                    }}
                    className="ml-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    Copy Link
                  </button>
                </div>
              ))}
            </div>
            <p className="text-sm text-blue-700 mt-3">
              💡 Copy these links and send them to the founders via email. Each link is unique and expires in 7 days.
            </p>
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSendInvitations}
          disabled={isLoading || !selectedEventId || !emailList.trim()}
          className={`w-full py-3 px-4 rounded-lg font-medium ${
            isLoading || !selectedEventId || !emailList.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Sending Invitations...' : 'Send Invitations'}
        </button>
      </div>
    </div>
  );
};
