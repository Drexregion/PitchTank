import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFounderUser } from '../hooks/useFounderUser';

/**
 * Integration test component to verify founder authentication flow
 * This component can be temporarily added to any page for testing
 */
export const FounderAuthTest: React.FC = () => {
  const { user, isFounder, founderUser, isLoading } = useAuth();
  const { founderUser: founderData, founderProjects, isLoading: founderLoading } = useFounderUser({ 
    founderUserId: founderUser?.id 
  });

  if (isLoading) {
    return <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">Loading auth...</div>;
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
      <h3 className="font-semibold text-blue-800">Founder Auth Test</h3>
      
      <div className="text-sm space-y-1">
        <div><strong>User:</strong> {user ? user.email : 'Not logged in'}</div>
        <div><strong>Is Founder:</strong> {isFounder ? 'Yes' : 'No'}</div>
        <div><strong>Founder User:</strong> {founderUser ? `${founderUser.first_name} ${founderUser.last_name}` : 'None'}</div>
        
        {isFounder && founderData && (
          <>
            <div><strong>Founder Data:</strong> {founderData.first_name} {founderData.last_name}</div>
            <div><strong>Projects:</strong> {founderProjects.length}</div>
            <div><strong>Founder Loading:</strong> {founderLoading ? 'Yes' : 'No'}</div>
          </>
        )}
      </div>
    </div>
  );
};
