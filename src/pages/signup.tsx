import React, { useState, useEffect } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';

const SignupPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [investorId, setInvestorId] = useState<string | null>(null);  
  const { signUp, user } = useAuth();
  // const eventId = searchParams.get('event');
  const eventId = "4df0c0f1-307f-42fb-b319-a99de3b26aeb";
  console.log("getting events from the url");
  console.log(eventId);
  console.log("getting the right user");
  console.log(user);
  
  // If already logged in, redirect to dashboard
  if (user && eventId) {
    console.log("user already logged in");
    console.log(eventId);
    console.log(user);
    return <Navigate to={`/dashboard/${eventId}`} replace />;
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    
    try {
      // Validate inputs
      console.log("test1");
      if (!name || !email || !password || !confirmPassword) {
        throw new Error('Please fill in all fields');
      }
       console.log("test2");
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
       console.log("test3");
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
       console.log("test4");
      // Submit sign-up to create auth account
      const { user: newUser, error: signUpError } = await signUp(email, password, name);
       console.log("test5");
      if (signUpError) throw signUpError;
      console.log("user created and test");
      console.log(eventId, newUser?.id)
      // If we have a specific event ID and the user was created successfully
      if (eventId && newUser?.id) {
        try {
          // Create investor record for this event
          console.log("creating investor record for event: ", eventId);
          const { data: investor, error: investorError } = await supabase
            .from('investors')
            .insert({
              event_id: eventId,
              name: name || email.split('@')[0],
              email: email,
              user_id: newUser.id,
              initial_balance: 1000000,
              current_balance: 1000000
            });
          console.log("investor created: ", investor);
          console.log("investor id: ", investor?.id);
          setInvestorId(investor?.id);
          setEventId(eventId);
            
          if (investorError) {
            console.error('Failed to create investor record:', investorError);
            // Don't throw here - the auth account was created successfully
          } else {
            // Create investor role
            await supabase
              .from('user_roles')
              .insert({
                user_id: newUser.id,
                role: 'investor',
                event_id: eventId
              });
            
            
          }
        } catch (err) {
          console.error('Error creating investor record:', err);
          // Don't throw - the auth account was created successfully
        }
      }
      
      // Show success message
      setSuccess('Your account has been created. Please check your email for verification.');
      
      // Clear form
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <div className="bg-white rounded-lg shadow-md w-full max-w-md p-8">
          <h1 className="text-2xl font-bold mb-6 text-center">Create an Account</h1>
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-gray-700 font-medium mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John Doe"
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="password" className="block text-gray-700 font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                minLength={8}
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Password must be at least 8 characters long
              </p>
            </div>
            
            <div className="mb-6">
              <label htmlFor="confirmPassword" className="block text-gray-700 font-medium mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Log In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
