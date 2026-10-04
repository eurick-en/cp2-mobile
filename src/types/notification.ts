export type DevicePlatform =
  | 'android'
  | 'ios';

export type NotificationDevice = {
  id: string;
  token: string;
  platform: DevicePlatform;
  enabled: boolean;
  updatedAt: number;
};

export type PushRegistrationResult =
  | {
      status: 'registered';
      token: string;
    }
  | {
      status: 'permission-denied';
      token: null;
    }
  | {
      status: 'project-id-missing';
      token: null;
    }
  | {
      status: 'unsupported-platform';
      token: null;
    }
  | {
      status: 'error';
      token: null;
    };