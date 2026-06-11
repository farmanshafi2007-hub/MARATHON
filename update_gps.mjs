import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /class GPSEngine \{[\s\S]*?processPoint\(rawPoint[\s\S]*?\}\n\s*\}/m;

const newGpsEngine = `class GPSEngine {
    lastValidPoint: { lat: number, lng: number } | null = null;
    totalDistance = 0; // meters
    lastValidTime = 0;
    
    // Kalman state
    kalmanLat = 0;
    kalmanLng = 0;
    kalmanP = 1; 

    // Pace/Smoothing windows
    recentPoints: { lat: number, lng: number, timestamp: number, accuracy: number }[] = [];
    validatedMovements: { dist: number, dt: number }[] = [];
    
    // Status locks
    isLocked = false;
    consecutiveGoodCount = 0;

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
        this.validatedMovements = [];
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

        // 1. Core Accuracy Constraint (< 15-20 meters required)
        if (accuracy > 21) {
            return { status: 'POOR_SIGNAL', distance: this.totalDistance, accuracy, speed: 0 };
        }

        // 2. Kalman Filter to eliminate noise
        const smoothed = this.applyKalmanFilter(latitude, longitude, accuracy);
        latitude = smoothed.lat;
        longitude = smoothed.lng;

        // 3. Prevent jumps using initialization constraints
        if (!this.isLocked) {
             this.consecutiveGoodCount++;
             if (this.consecutiveGoodCount >= 3) {
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

        // 4. Movement detection
        const dt = (timestamp - this.lastValidTime) / 1000; 
        if (dt <= 0) return { status: 'INVALID_TIME', distance: this.totalDistance, accuracy, speed: 0 };

        const dist = this.haversine(this.lastValidPoint.lat, this.lastValidPoint.lng, latitude, longitude);
        
        const speedMs = dist / dt;
        const speedKmh = speedMs * 3.6;

        // Reject teleportation logic
        if (speedKmh > 35) {
            return { status: 'NOISE', distance: this.totalDistance, accuracy, speed: 0 }; 
        }

        // Drift / Indoor checking
        // For standard pedestrian logic, dist should exceed noise threshold
        const noiseFloor = Math.max(8, accuracy / 1.5);
        
        if (dist < noiseFloor || speedKmh < 1.0) { // Standing still logic
            return { status: 'STATIONARY', distance: this.totalDistance, accuracy, speed: 0 };
        }

        // Apply point permanently
        this.totalDistance += dist;
        this.lastValidPoint = { lat: latitude, lng: longitude };
        this.lastValidTime = timestamp;

        // Compute rolling speed
        this.validatedMovements.push({ dist, dt });
        const fresh = [];
        let sumDist = 0; let sumDt = 0;
        for (const mov of this.validatedMovements) {
            sumDist += mov.dist;
            sumDt += mov.dt;
            fresh.push(mov);
        }
        this.validatedMovements = fresh.slice(-10); // keep last 10 ticks for smoothness

        const rollingAvMs = sumDt > 0 ? (sumDist / sumDt) : 0;

        return { 
            status: 'MOVING', 
            distance: this.totalDistance, 
            accuracy, 
            speed: rollingAvMs * 3.6,
            coords: { lat: latitude, lng: longitude }
        };
    }`;

content = content.replace(regex, newGpsEngine);

const watchRegex = /watchRef\.current\s+=\s+navigator\.geolocation\.watchPosition\(\(p\)\s+=>\s+\{[\s\S]*?\}\);/m;

const newWatch = `watchRef.current = navigator.geolocation.watchPosition((p) => {
                setAccuracy(p.coords.accuracy);
                if (isPausedRef.current) return; 

                const result = gpsEngineRef.current.processPoint(p);
                if (result.status === 'POOR_SIGNAL' || result.status === 'LOW_ACCURACY') {
                    setGpsStatus("POOR SIGNAL");
                    return;
                }
                if (result.status === 'LOCKING') {
                    setGpsStatus("LOCKING...");
                    return;
                }
                if (result.status === 'STATIONARY') {
                    setGpsStatus("GPS READY");
                    runDataRef.current.speed = 0;
                    setAutoPaused(true);
                    return;
                }
                if (result.status === 'NOISE' || result.status === 'INVALID_TIME') return;
                
                if (result.status === 'AUTO_PAUSED') {
                    setGpsStatus("AUTO PAUSED");
                    setAutoPaused(true);
                    runDataRef.current.speed = 0;
                    return;
                }

                // If moving
                setAutoPaused(false);
                if (result.status === 'MOVING') {
                    setGpsStatus("GPS READY");
                    runDataRef.current.distance = result.distance;
                    runDataRef.current.speed = result.speed;
                    if (result.coords) {
                        runDataRef.current.coordinates.push(result.coords);
                    }
                }
            }, (error) => {
                console.error("GPS Error:", error);
            }, {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000
            });`;

content = content.replace(watchRegex, newWatch);
fs.writeFileSync('src/App.tsx', content);
