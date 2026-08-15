import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import type { TeamMember } from '../types';

export interface OfficeLocation {
  latitude: number;
  longitude: number;
  radius: number; // in meters (default 100)
  name: string;
  updatedAt?: number;
  updatedBy?: string;
}

// Default fallback office location if not yet configured by admin
export const DEFAULT_OFFICE_LOCATION: OfficeLocation = {
  latitude: 11.2588, // Example Calicut / Kerala coordinates
  longitude: 75.7804,
  radius: 100, // 100 meters
  name: 'Nyghto HQ',
};

// Haversine formula to calculate exact distance in meters between two GPS coordinates
export function calculateDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Fetch configured office location from Firestore
export async function getOfficeLocation(): Promise<OfficeLocation> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'office_location'));
    if (snap.exists()) {
      return snap.data() as OfficeLocation;
    }
  } catch (error) {
    console.error("Error getting office location:", error);
  }
  return DEFAULT_OFFICE_LOCATION;
}

// Save or update office location (Admin only)
export async function saveOfficeLocation(
  location: Partial<OfficeLocation>,
  adminName: string = 'Admin'
): Promise<void> {
  const current = await getOfficeLocation();
  const updated: OfficeLocation = {
    latitude: location.latitude ?? current.latitude,
    longitude: location.longitude ?? current.longitude,
    radius: location.radius ?? current.radius ?? 100,
    name: location.name ?? current.name ?? 'Nyghto HQ',
    updatedAt: Date.now(),
    updatedBy: adminName
  };

  await setDoc(doc(db, 'settings', 'office_location'), updated, { merge: true });
}

export interface AutoAttendanceResult {
  status: 'marked_present' | 'already_marked' | 'outside_radius' | 'permission_denied' | 'error';
  distance?: number;
  radius?: number;
  message: string;
}

// Check location and automatically mark Present if within 100m radius
export async function verifyAndMarkAutoAttendance(
  userEmail: string,
  userName: string,
  teamMembers: TeamMember[]
): Promise<AutoAttendanceResult> {
  if (!navigator.geolocation) {
    return {
      status: 'error',
      message: 'Geolocation is not supported by your browser'
    };
  }

  const cleanEmail = userEmail.toLowerCase().trim();
  const member = teamMembers.find(m => m.email?.toLowerCase().trim() === cleanEmail);
  if (!member) {
    return {
      status: 'error',
      message: 'User is not registered in team members'
    };
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const docId = `${dateStr}_${member.id}`;

  try {
    // 1. Check if already marked today
    const attendanceDoc = await getDoc(doc(db, 'attendance', docId));
    if (attendanceDoc.exists()) {
      const data = attendanceDoc.data();
      if (data.status === 'Present') {
        return {
          status: 'already_marked',
          message: 'Attendance already marked as Present for today'
        };
      }
      if (data.status === 'Off Day') {
        return {
          status: 'already_marked',
          message: 'Today is marked as an Off Day'
        };
      }
    }

    // 2. Fetch current office location
    const office = await getOfficeLocation();

    // 3. Get user's current GPS position
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;
    const distance = calculateDistanceInMeters(userLat, userLon, office.latitude, office.longitude);
    const radius = office.radius || 100;

    // 4. If within radius (100m) -> Mark Present automatically!
    if (distance <= radius) {
      await setDoc(doc(db, 'attendance', docId), {
        userId: member.id,
        date: dateStr,
        status: 'Present',
        autoMarked: true,
        distanceMeters: Math.round(distance),
        checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        updatedAt: serverTimestamp(),
        updatedBy: 'GPS Geofence (100m Auto)'
      }, { merge: true });

      await addDoc(collection(db, 'activities'), {
        text: `📍 ${userName} verified via 100m Office GPS (${Math.round(distance)}m away) - Attendance marked Present`,
        type: 'report',
        iconColor: 'text-green-500',
        createdAt: serverTimestamp()
      });

      return {
        status: 'marked_present',
        distance: Math.round(distance),
        radius,
        message: `📍 Office Geofence Verified! You are within ${Math.round(distance)}m of office. Marked as Present.`
      };
    } else {
      return {
        status: 'outside_radius',
        distance: Math.round(distance),
        radius,
        message: `Outside office radius (${Math.round(distance)}m away from 100m geofence).`
      };
    }
  } catch (error: any) {
    if (error?.code === 1) {
      return {
        status: 'permission_denied',
        message: 'Location permission was denied. Please enable GPS in browser to use auto-attendance.'
      };
    }
    if (error?.code === 2 || error?.code === 3) {
      return {
        status: 'error',
        message: 'GPS location unavailable or timed out. Please click "Verify My Location".'
      };
    }
    return {
      status: 'error',
      message: 'Location verification not available.'
    };
  }
}
