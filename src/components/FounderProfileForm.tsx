import React, { useState } from 'react';
import { FounderUser, UpdateFounderUserRequest } from '../types/FounderUser';

interface FounderProfileFormProps {
  founderUser: FounderUser;
  onUpdate: (data: UpdateFounderUserRequest) => Promise<{ success: boolean; error?: string }>;
  isLoading?: boolean;
  className?: string;
}

export const FounderProfileForm: React.FC<FounderProfileFormProps> = ({
  founderUser,
  onUpdate,
  isLoading = false,
  className = ''
}) => {
  const [formData, setFormData] = useState({
    first_name: founderUser.first_name,
    last_name: founderUser.last_name,
    bio: founderUser.bio || '',
    profile_picture_url: founderUser.profile_picture_url || ''
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setError('First name and last name are required');
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);

      const result = await onUpdate({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        bio: formData.bio.trim() || null,
        profile_picture_url: formData.profile_picture_url.trim() || null
      });

      if (result.success) {
        setSuccessMessage('Profile updated successfully');
      } else {
        setError(result.error || 'Failed to update profile');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h3 className="text-xl font-bold mb-6">Profile Settings</h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={founderUser.email}
            disabled
            className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
          />
          <p className="text-sm text-gray-500 mt-1">
            Email cannot be changed. Contact support if needed.
          </p>
        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name *
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={handleInputChange('first_name')}
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={handleInputChange('last_name')}
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Profile Picture URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Profile Picture URL
          </label>
          <input
            type="url"
            value={formData.profile_picture_url}
            onChange={handleInputChange('profile_picture_url')}
            placeholder="https://example.com/profile-picture.jpg"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Optional: URL to your profile picture
          </p>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bio
          </label>
          <textarea
            value={formData.bio}
            onChange={handleInputChange('bio')}
            placeholder="Tell us about yourself, your background, and experience..."
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
          <p className="text-sm text-gray-500 mt-1">
            Optional: Brief description about yourself
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-lg font-medium ${
            isLoading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Updating Profile...' : 'Update Profile'}
        </button>
      </form>
    </div>
  );
};
