import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDoc, 
  deleteDoc, 
  increment, 
  query, 
  where, 
  orderBy, 
  onSnapshot
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAwA2fAP-il12vsyeFEy5QEr_1n9qWRpXk",
  authDomain: "official-run-615df.firebaseapp.com",
  databaseURL: "https://official-run-615df-default-rtdb.firebaseio.com",
  projectId: "official-run-615df",
  storageBucket: "official-run-615df.firebasestorage.app",
  messagingSenderId: "1034499388791",
  appId: "1:1034499388791:web:fc892a70034a44462edd72"
};

// 1. Initialization & Export
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 2. User Profiles
/**
 * Call this when a user signs up or logs in for the first time.
 * @example createUserProfile(user.uid, "John Doe", "https://pic.url/johndoe");
 */
export async function createUserProfile(userId: string, name: string, profilePic: string | null) {
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, {
    userId,
    displayName: name,
    profilePic: profilePic || "",
    totalDistanceKm: 0,
    createdAt: serverTimestamp()
  }, { merge: true });
}

// 3. Activity Storage
/**
 * Call this when a user finishes a run/walk to save the activity.
 * @example saveActivity(user.uid, 5.2, 1800, "5'45\"", [{lat: 34, lng: -118}]);
 */
export async function saveActivity(
  userId: string, 
  distanceKm: number, 
  durationSeconds: number, 
  averagePace: string, 
  gpsRouteArray: any[]
) {
  const activitiesRef = collection(db, "activities");
  return await addDoc(activitiesRef, {
    userId,
    distanceKm,
    durationSeconds,
    averagePace,
    gpsRoute: gpsRouteArray,
    likeCount: 0,
    timestamp: serverTimestamp()
  });
}

// 4. Atomic Social Likes
/**
 * Call this to toggle a like on an activity. 
 * @example toggleLikeActivity("activity_doc_id", user.uid);
 */
export async function toggleLikeActivity(activityId: string, userId: string) {
  // Unique compound tracking ID pattern
  const likeId = `${activityId}_${userId}`;
  const likeRef = doc(db, "likes", likeId);
  const activityRef = doc(db, "activities", activityId);

  const likeSnap = await getDoc(likeRef);

  if (!likeSnap.exists()) {
    // If the like does NOT exist: Add like document and increment count
    await setDoc(likeRef, { activityId, userId, timestamp: serverTimestamp() });
    await setDoc(activityRef, { likeCount: increment(1) }, { merge: true });
    return true; // Returning true to signify the item is now liked
  } else {
    // If the like DOES exist: Delete like document and decrement count
    await deleteDoc(likeRef);
    await setDoc(activityRef, { likeCount: increment(-1) }, { merge: true });
    return false; // Returning false to signify the item is now unliked
  }
}

// 5. Real-Time Reverse-Chronological Profile Feed
/**
 * Call this to listen to a user's activity feed in real time.
 * @example const unsubscribe = getUserActivities(user.uid, (activities) => setActivities(activities));
 */
export function getUserActivities(userId: string, callback: (activities: any[]) => void) {
  const q = query(
    collection(db, "activities"),
    where("userId", "==", userId),
    orderBy("timestamp", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const activities: any[] = [];
    snapshot.forEach((doc) => {
      activities.push({ id: doc.id, ...doc.data() });
    });
    callback(activities);
  });
}
