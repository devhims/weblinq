# API Key Management Feature

This document describes the new API key management functionality added to the dashboard.

## Overview

Users can now create, view, and manage API keys directly from their dashboard. This feature provides a secure way for users to access the backend API programmatically.

## Features

### 🔑 Create API Keys

- Generate new API keys with custom names
- Input validation and name suggestions
- Secure key generation with system defaults
- One-time display of the full key for security

### 📊 View API Keys

- List all API keys with detailed information
- Display usage statistics (requests made, remaining quota)
- Show key status (active, disabled, expired)
- Masked key display for security

### 🗑️ Delete API Keys

- Safely remove API keys when no longer needed
- Confirmation dialog to prevent accidental deletion
- Immediate effect - deleted keys are invalidated

### 🔄 Real-time Updates

- Refresh functionality to get latest data
- Automatic reload after create/delete operations
- Loading states for better UX

## Default Settings

When creating new API keys, the following defaults are applied:

- **Prefix**: `wq_`
- **Rate Limit**: 1000 requests per 24 hours
- **Expiration**: No expiration date
- **Plan**: Free tier metadata

## Security Features

1. **One-time Display**: Full API keys are only shown once during creation
2. **Masked Display**: Keys are partially hidden in the list view
3. **Session-based Auth**: All API calls use authenticated sessions
4. **Input Validation**: Key names are validated for security
5. **Confirmation Dialogs**: Prevent accidental key deletion

## User Interface

### Dashboard Layout

- **Left Column**: User account information and API usage overview
- **Right Column**: API key management interface
- **Bottom Section**: Welcome message with feature highlights

### Key Management Interface

- **Header**: Title, description, and "Create New Key" button
- **Create Form**: Name input with validation and suggestions
- **Key Display**: Temporary display of newly created keys
- **Key List**: Existing keys with details and actions
- **Refresh Button**: Manual data reload option

## Technical Implementation

### Frontend Components

- `ApiKeyManager`: Main component for key management
- `api-keys.ts`: Service functions for API communication
- `api-key-utils.ts`: Utility functions for formatting and validation

### Backend Integration

- Uses existing `/api-keys/*` endpoints
- Authenticated with session cookies
- Error handling and validation
- Consistent API response formats

### Features

- Real-time validation
- Copy-to-clipboard functionality
- Responsive design
- Loading states and error handling
- Success/error notifications

## Usage Guide

1. **Navigate to Dashboard**: Log in and go to your dashboard
2. **Create API Key**: Click "Create New Key" and enter a descriptive name
3. **Copy Key**: Immediately copy the generated key (it won't be shown again)
4. **Use API Key**: Include the key in your API requests as authentication
5. **Manage Keys**: View usage statistics and delete unused keys

## API Integration

Use the generated API keys in your applications by including them in request headers:

```javascript
fetch('http://localhost:8787/api/endpoint', {
  headers: {
    Authorization: 'Bearer your-api-key-here',
    'Content-Type': 'application/json',
  },
});
```

## File Structure

```
frontend/src/
├── components/dashboard/
│   ├── ApiKeyManager.tsx        # Main component
│   └── index.ts                 # Component exports
├── lib/
│   ├── api-keys.ts             # API service functions
│   └── utils/
│       └── api-key-utils.ts    # Utility functions
└── app/dashboard/
    └── page.tsx                # Updated dashboard page
```

## Future Enhancements

- API usage analytics and charts
- Key expiration date configuration
- Custom rate limit settings
- Key permissions and scopes
- Webhook notifications for key usage
- Export key usage reports
