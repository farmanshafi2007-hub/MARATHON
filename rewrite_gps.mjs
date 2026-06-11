import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const oldGpsEngine = content.match(/class GPSEngine \{[\s\S]*?\}\n\}\n\n\/\/ --- SAFE DATE PARSER ---/);
if (!oldGpsEngine) {
    console.error("Could not find GPSEngine");
    process.exit(1);
}

const newGpsEngine = `class GPSEngine {
    lastValidPoint: { lat: number, lng: number } | null = null;
    totalDistance = 0; // meters
    lastValidTime = 0;
    
    // 30-second window of validated movements for pace calculation
    validatedMovements: { dist: number, dt: number }[] = [];
    
    kalmanLat = 0;
    kalmanLng = 0;
    kalmanP = 1; 
    
    lowSpeedDuration = 0;
    consecutiveGoodAccuracyCount = 0;
    isLocked = false;

    haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371e3; // Earth radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    pause() {
        this.lastValidPoint = null;
        this.lowSpeedDuration = 0;
        this.validatedMovements = [];
    }

    applyKalmanFilter(lat: number, lng: number, accuracy: number) {
         if (this.kalmanLat === 0) {
             this.kalmanLat = lat;
             this.kalmanLng = lng;
             this.kalmanP = accuracy * accuracy;
             return { lat, lng };
         }
         const Q = 0.00001; // process noise
         const R = accuracy * accuracy; // measurement noise
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

        // 1. Accuracy Check
        if (accuracy > 50) return { status: 'LOW_ACCURACY', distance: this.totalDistance, accuracy, speed: 0 };
        if (accuracy > 20) return { status: 'POOR_SIGNAL', distance: this.totalDistance, accuracy, speed: 0 };

        // 2. Kalman Filter
        const smoothed = this.applyKalmanFilter(latitude, longitude, accuracy);
        latitude = smoothed.lat;
        longitude = smoothed.lng;

        // 3. Lock acquisition
        if (!this.isLocked) {
            if (accuracy <= 20) {
                this.consecutiveGoodAccuracyCount++;
                if (this.consecutiveGoodAccuracyCount >= 2) {
                    this.isLocked = true;
                    this.lastValidPoint = { lat: latitude, lng: longitude };
                    this.lastValidTime = timestamp;
                    return { status: 'LOCKED', distance: this.totalDistance, accuracy, speed: 0, coords: { lat: latitude, lng: longitude } };
                }
            }
            return { status: 'LOCKING', distance: this.totalDistance, accuracy, speed: 0 };
        }

        if (!this.lastValidPoint) {
            this.lastValidPoint = { lat: latitude, lng: longitude };
            this.lastValidTime = timestamp;
            return { status: 'WAITING', distance: this.totalDistance, accuracy, speed: 0 };
        }

        // 4. Distance and Validation
        const dt = (timestamp - this.lastValidTime) / 1000; 
        if (dt <= 0) return { status: 'INVALID_TIME', distance: this.totalDistance, accuracy, speed: 0 };

        const dist = this.haversine(this.lastValidPoint.lat, this.lastValidPoint.lng, latitude, longitude);
        
        const speedMs = dist / dt;
        const speedKmh = speedMs * 3.6;
        
        if (speedKmh > 35) {
            return { status: 'NOISE', distance: this.totalDistance, accuracy, speed: 0 }; 
        }

        const distThreshold = Math.max(8, accuracy);
        
        if (dist < distThreshold || speedKmh < 1.5) {
            this.lowSpeedDuration = dt; 
            if (this.lowSpeedDuration >= 10) {
                return { status: 'AUTO_PAUSED', distance: this.totalDistance, accuracy, speed: 0 };
            }
            return { status: 'STATIONARY', distance: this.totalDistance, accuracy, speed: 0 };
        }

        // 5. Validated Movement
        this.totalDistance += dist;
        this.lastValidPoint = { lat: latitude, lng: longitude };
        this.lastValidTime = timestamp;
        this.lowSpeedDuration = 0;
        
        // Push validated movement
        this.validatedMovements.push({ dist, dt });
        
        let sumDt = 0;
        for (let i = this.validatedMovements.length - 1; i >= 0; i--) {
            sumDt += this.validatedMovements[i].dt;
        }
        while (this.validatedMovements.length > 0 && sumDt > 30) {
            const removed = this.validatedMovements.shift();
            if (removed) sumDt -= removed.dt;
        }
        
        let sumWDist = 0;
        let sumWT = 0;
        for (const mov of this.validatedMovements) {
            sumWDist += mov.dist;
            sumWT += mov.dt;
        }
        
        let rollingSpeedKmh = 0;
        if (sumWT > 0) {
            rollingSpeedKmh = (sumWDist / sumWT) * 3.6;
        } else {
            rollingSpeedKmh = speedKmh;
        }

        return { 
            status: 'MOVING', 
            distance: this.totalDistance, 
            accuracy, 
            speed: rollingSpeedKmh, 
            coords: { lat: latitude, lng: longitude }
        };
    }
}

// --- SAFE DATE PARSER ---`;

content = content.replace(oldGpsEngine[0], newGpsEngine);
fs.writeFileSync('src/App.tsx', content);
