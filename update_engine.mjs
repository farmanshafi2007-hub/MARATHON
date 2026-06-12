import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const engineRegex = /class GPSEngine \{[\s\S]*?return \{\s*status: 'MOVING'[\s\S]*?\};\s*\}/m;

const newEngine = `class GPSEngine {
    lastValidPoint: { lat: number, lng: number } | null = null;
    totalDistance: number = 0; 
    lastValidTime: number = 0;
    
    kalmanLat: number = 0;
    kalmanLng: number = 0;
    kalmanP: number = 1; 

    recentPoints: { dist: number, dt: number, timestamp: number }[] = [];
    
    isLocked: boolean = false;
    consecutiveGoodCount: number = 0;
    activityState: 'idle' | 'moving' = 'idle';
    movementConfirmCount: number = 0;

    haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371e3; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    pause() {
        this.lastValidPoint = null;
        this.recentPoints = [];
        this.activityState = 'idle';
        this.movementConfirmCount = 0;
    }

    applyKalmanFilter(lat: number, lng: number, accuracy: number) {
         if (this.kalmanLat === 0) {
             this.kalmanLat = lat;
             this.kalmanLng = lng;
             this.kalmanP = accuracy * accuracy;
             return { lat, lng };
         }
         const Q = 0.00001; 
         const R = accuracy * accuracy; 
         this.kalmanP += Q;
         const K = this.kalmanP / (this.kalmanP + R);
         this.kalmanLat = this.kalmanLat + K * (lat - this.kalmanLat);
         this.kalmanLng = this.kalmanLng + K * (lng - this.kalmanLng);
         this.kalmanP = (1 - K) * this.kalmanP;
         return { lat: this.kalmanLat, lng: this.kalmanLng };
    }

    processPoint(rawPoint: GeolocationPosition) {
        let { latitude, longitude, accuracy } = rawPoint.coords;
        const timestamp = rawPoint.timestamp || Date.now();

        // 1. Adaptive Accuracy Threshold (Do not process if accuracy > 15m)
        if (accuracy > 15) {
            return { status: 'POOR_SIGNAL', distance: this.totalDistance, accuracy, speed: 0 };
        }

        // 2. Data Smoothing (Kalman Filter)
        const smoothed = this.applyKalmanFilter(latitude, longitude, accuracy);
        latitude = smoothed.lat;
        longitude = smoothed.lng;

        if (!this.isLocked) {
             this.consecutiveGoodCount++;
             if (this.consecutiveGoodCount >= 2) {
                 this.isLocked = true;
                 this.lastValidPoint = { lat: latitude, lng: longitude };
                 this.lastValidTime = timestamp;
                 return { status: 'LOCKED', distance: this.totalDistance, accuracy, speed: 0, coords: { lat: latitude, lng: longitude } };
             }
             return { status: 'LOCKING', distance: this.totalDistance, accuracy, speed: 0 };
        }

        if (!this.lastValidPoint) {
            this.lastValidPoint = { lat: latitude, lng: longitude };
            this.lastValidTime = timestamp;
            return { status: 'WAITING', distance: this.totalDistance, accuracy, speed: 0 };
        }

        const dt = (timestamp - this.lastValidTime) / 1000; 
        if (dt <= 0) return { status: 'INVALID_TIME', distance: this.totalDistance, accuracy, speed: 0 };

        // 3. Distance Calculation (Haversine)
        const dist = this.haversine(this.lastValidPoint.lat, this.lastValidPoint.lng, latitude, longitude);
        
        // 4. Movement filtering ('Dead-band' logic < 3 meters)
        if (dist < 3) {
            this.movementConfirmCount = 0;
            this.activityState = 'idle';
            return { status: 'STATIONARY', distance: this.totalDistance, accuracy, speed: 0 };
        }

        const speedMs = dist / dt;
        const speedKmh = speedMs * 3.6;

        if (speedKmh > 35) {
            return { status: 'Signal Lost', distance: this.totalDistance, accuracy, speed: 0 }; 
        }

        // 5. Activity State Management (Confirm moving by 3 consecutive points)
        this.movementConfirmCount++;
        if (this.movementConfirmCount >= 3) {
            this.activityState = 'moving';
        }

        // Update permanent distance only if we passed dead-band
        this.totalDistance += dist;
        this.lastValidPoint = { lat: latitude, lng: longitude };
        this.lastValidTime = timestamp;

        // 6. Pace Calculation (Rolling Average last 30 seconds)
        this.recentPoints.push({ dist, dt, timestamp });
        
        // Clean out points older than 30 seconds
        this.recentPoints = this.recentPoints.filter(p => (timestamp - p.timestamp) <= 30000);

        let sumDist = 0;
        let sumDt = 0;
        for (const pt of this.recentPoints) {
            sumDist += pt.dist;
            sumDt += pt.dt;
        }

        // Only calculate speed if state is 'moving'
        let rollingAvMs = 0;
        if (this.activityState === 'moving' && sumDt > 0) {
            rollingAvMs = sumDist / sumDt;
        }

        return { 
            status: 'MOVING', 
            distance: this.totalDistance, 
            accuracy, 
            speed: rollingAvMs, 
            coords: { lat: latitude, lng: longitude } 
        };
    }`;

content = content.replace(engineRegex, newEngine);
fs.writeFileSync('src/App.tsx', content);
