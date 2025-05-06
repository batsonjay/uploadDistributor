# API Integration Strategy

This document outlines the strategy for integrating with real APIs while maintaining the ability to use mocks during development.

## Centralized Configuration Approach

### 1. Create a Configuration Module

```typescript
// src/config.ts
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // General settings
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // API mode settings (mock vs real)
  useMockApis: process.env.USE_MOCK_APIS === 'true',
  
  // AzuraCast settings
  azuracast: {
    useRealApi: process.env.USE_REAL_AZURACAST === 'true',
    baseUrl: process.env.AZURACAST_API_URL || 'https://radio.balearic-fm.com',
    apiKey: process.env.AZURACAST_API_KEY || '',
    stationId: process.env.AZURACAST_STATION_ID || '2' // Default to dev/test station
  },
  
  // Mixcloud settings
  mixcloud: {
    useRealApi: process.env.USE_REAL_MIXCLOUD === 'true',
    baseUrl: process.env.MIXCLOUD_API_URL || 'https://api.mixcloud.com',
    apiKey: process.env.MIXCLOUD_API_KEY || ''
  },
  
  // SoundCloud settings
  soundcloud: {
    useRealApi: process.env.USE_REAL_SOUNDCLOUD === 'true',
    baseUrl: process.env.SOUNDCLOUD_API_URL || 'https://api.soundcloud.com',
    apiKey: process.env.SOUNDCLOUD_API_KEY || ''
  }
};
```

### 2. Update .env.example

```
# Server Configuration
PORT=3001
NODE_ENV=development

# API Mode (mock vs real)
USE_MOCK_APIS=true

# AzuraCast Configuration
USE_REAL_AZURACAST=false
AZURACAST_API_URL=https://radio.balearic-fm.com
AZURACAST_API_KEY=your-api-key
AZURACAST_STATION_ID=2

# Mixcloud Configuration
USE_REAL_MIXCLOUD=false
MIXCLOUD_API_URL=https://api.mixcloud.com
MIXCLOUD_API_KEY=your-api-key

# SoundCloud Configuration
USE_REAL_SOUNDCLOUD=false
SOUNDCLOUD_API_URL=https://api.soundcloud.com
SOUNDCLOUD_API_KEY=your-api-key

# Logging
LOG_LEVEL=debug

# File Storage
UPLOAD_DIR=./uploads
TEMP_DIR=./temp
```

### 3. Modify Service Classes

```typescript
// AzuraCastService.ts
import { config } from '../config';
import { AzuraCastApiMock } from '../mocks/AzuraCastApiMock';
import axios from 'axios';
import { StatusManager } from './StatusManager';

export class AzuraCastService {
  private mockApi: AzuraCastApiMock | null;
  private statusManager: StatusManager;
  
  constructor(statusManager: StatusManager) {
    this.statusManager = statusManager;
    
    // Only create the mock if we're using it
    this.mockApi = config.azuracast.useRealApi ? null : new AzuraCastApiMock();
  }
  
  // Methods that use the config to determine which implementation to use
  public async getUserProfile(token?: string): Promise<any> {
    if (!config.azuracast.useRealApi) {
      return this.mockApi!.getUserProfile(token || 'mock-token');
    } else {
      // Real implementation using config.azuracast.baseUrl and config.azuracast.apiKey
      // ...
    }
  }
  
  // Other methods follow the same pattern
}
```

## Benefits of This Approach

1. **Centralized Configuration**: All API settings are in one place
2. **Gradual Migration**: You can enable real APIs one at a time
3. **Consistent Pattern**: Same approach works for all three destinations
4. **Easy Cleanup**: When ready, you can remove the conditional logic from all services at once
5. **Flexible Testing**: You can mix and match which APIs are real vs. mock during development

## Implementation Steps

1. Create the config.ts file
2. Update .env.example and create a .env file with your actual values
3. Modify each service class to use the config
4. Implement real API calls for each method, conditionally using them based on the config
5. Test each API integration individually by toggling the appropriate environment variable
