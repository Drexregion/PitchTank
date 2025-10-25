import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useFounderAuth } from '../hooks/useFounderAuth';
import { CreateFounderUserRequest } from '../types/FounderUser';

export const FounderSignupForm: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { validateInvitation, createFounderAccount, markInvitationUsed, invitation, isValidInvitation, isLoading: authLoading, error: authError } = useFounderAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Validate invitation token on component mount
  useEffect(() => {
    if (token) {
      validateInvitation(token);
    }
  }, [token, validateInvitation]);

  // Pre-fill email from invitation
  useEffect(() => {
    if (invitation && invitation.email) {
      setFormData(prev => ({
        ...prev,
        email: invitation.email
      }));
    }
  }, [invitation]);

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email.trim() || !formData.password || !formData.firstName.trim() || !formData.lastName.trim()) {
      setError('All fields are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!invitation || invitation.email !== formData.email) {
      setError('Email does not match invitation');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('Starting signup process for:', formData.email);

      // First, check if founder user already exists
      const { data: existingFounder, error: founderCheckError } = await supabase
        .from('founder_users')
        .select('*')
        .eq('email', formData.email)
        .maybeSingle();

      
      if (existingFounder || founderCheckError) {
        let errorMessage : string | null = null;
        if (existingFounder) {
          errorMessage = 'This email is already registered as a founder. Please sign in instead.';
        } else if (founderCheckError) {
          errorMessage = founderCheckError.message;
        }
        setError(errorMessage);
        return;
      }

      console.log('No existing founder user found, proceeding with signup...');
      
      // Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName
          }
        }
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      console.log('Auth user created successfully:', authData.user.id);

      // Create founder user record
      const founderData: CreateFounderUserRequest = {
        auth_user_id: authData.user.id,
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName
      };

      const result = await createFounderAccount(founderData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create founder account');
      }

      // Mark invitation as used
      if (token) {
        await markInvitationUsed(token);
      }

      // Redirect to founder dashboard
      navigate('/founder-dashboard');
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while validating invitation
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  // Show error if invitation is invalid
  if (!isValidInvitation || authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Invitation</h2>
            <p className="text-gray-600 mb-4">
              {authError || 'This invitation link is invalid or has expired.'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Complete Your Founder Account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You've been invited to join as a founder. Complete your account setup below.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="mt-1 w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                This email was used for your invitation
              </p>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={handleInputChange('firstName')}
                  required
                  className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={handleInputChange('lastName')}
                  required
                  className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={handleInputChange('password')}
                required
                minLength={6}
                className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Confirm Password *
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                required
                minLength={6}
                className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {isLoading ? 'Creating Account...' : 'Create Founder Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
