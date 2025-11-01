document.addEventListener('DOMContentLoaded', () => {
    // Map init
    const map = L.map('map').setView([26.85, 80.95], 10); 
    L.esri.basemapLayer('Imagery', { attribution: 'Tiles ©️ Esri' }).addTo(map);
    L.esri.basemapLayer('ImageryLabels').addTo(map);

    // State
    let startMarker = null, endMarker = null, routeLayer = null;
    let selectionMode = 'start', roadBlockMode = false, blockedRoads = [];
    let emergencyType = 'high'; // Default
    let lastRouteDurationMinutes = null;

    // UI refs
    const startInput = document.getElementById('start-input');
    const endInput = document.getElementById('end-input');
    const clearPointsBtn = document.getElementById('clear-points');
    const calculateRouteBtn = document.getElementById('calculate-route');
    const routeInfoDiv = document.getElementById('route-info'); 
    const routeSummaryDiv = document.getElementById('route-summary');
    const etaDisplay = document.getElementById('eta-display');
    const emergencyOptions = document.querySelectorAll('.emergency-option');
    const blockRoadBtn = document.getElementById('block-road-mode');
    const blockedRoadsList = document.getElementById('blocked-roads-list');
    const simulateTrafficBtn = document.getElementById('simulate-traffic');

    const ROUTE_COLOR = '#007bff';
    const START_PLACEHOLDER = '<span class="placeholder">Click map to set start point...</span>';
    const END_PLACEHOLDER = '<span class="placeholder">Click map to set end point...</span>';

    // Wiring
    startInput.addEventListener('click', () => { 
        if (!roadBlockMode) {
            selectionMode = 'start'; 
            updateSelectionModeDisplay();
        }
    });
    endInput.addEventListener('click', () => {
        if (!roadBlockMode) {
            selectionMode = 'end';
            updateSelectionModeDisplay();
        }
    });
    
    clearPointsBtn.addEventListener('click', clearAllPoints);
    calculateRouteBtn.addEventListener('click', calculateOptimalRoute);
    blockRoadBtn.addEventListener('click', toggleRoadBlockMode);
    simulateTrafficBtn.addEventListener('click', simulateTrafficConditions);

    emergencyOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            emergencyOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            emergencyType = opt.dataset.type;
        });
    });

    map.on('click', (e) => {
        if (roadBlockMode) addRoadBlock(e.latlng);
        else if (selectionMode === 'start') setStartPoint(e.latlng);
        else if (selectionMode === 'end') setEndPoint(e.latlng);
    });

    function updateSelectionModeDisplay() {
        startInput.classList.toggle('active', selectionMode === 'start' && !roadBlockMode);
        endInput.classList.toggle('active', selectionMode === 'end' && !roadBlockMode);
    }

    function setStartPoint(latlng) {
        if (startMarker) map.removeLayer(startMarker);
        startMarker = L.marker(latlng, { draggable: true, icon: L.divIcon({
            className: 'start-marker', html: '<div style="background:#2ecc71;border-radius:50%;width:20px;height:20px;"></div>',
            iconSize: [26, 26], iconAnchor: [13, 13]
        }) }).addTo(map).bindPopup('Start Point').openPopup();
        
        startMarker.on('dragend', () => { 
            startInput.innerHTML = `<span class="value">Lat: ${startMarker.getLatLng().lat.toFixed(4)}, Lng: ${startMarker.getLatLng().lng.toFixed(4)}</span>`;
            calculateRouteBtn.disabled = !(startMarker && endMarker); 
        });
        
        startInput.innerHTML = `<span class="value">Lat: ${latlng.lat.toFixed(4)}, Lng: ${latlng.lng.toFixed(4)}</span>`;
        calculateRouteBtn.disabled = !(startMarker && endMarker);
        selectionMode = 'end';
        updateSelectionModeDisplay();
    }

    function setEndPoint(latlng) {
        if (endMarker) map.removeLayer(endMarker);
        endMarker = L.marker(latlng, { draggable: true, icon: L.divIcon({
            className: 'end-marker', html: '<div style="background:#e74c3c;border-radius:50%;width:20px;height:20px;"></div>',
            iconSize: [26, 26], iconAnchor: [13, 13]
        }) }).addTo(map).bindPopup('End Point').openPopup();
        
        endMarker.on('dragend', () => { 
            endInput.innerHTML = `<span class="value">Lat: ${endMarker.getLatLng().lat.toFixed(4)}, Lng: ${endMarker.getLatLng().lng.toFixed(4)}</span>`;
            calculateRouteBtn.disabled = !(startMarker && endMarker); 
        });

        endInput.innerHTML = `<span class="value">Lat: ${latlng.lat.toFixed(4)}, Lng: ${latlng.lng.toFixed(4)}</span>`;
        calculateRouteBtn.disabled = !(startMarker && endMarker);
        selectionMode = 'start';
        updateSelectionModeDisplay();
    }

    function clearAllPoints() {
        if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
        if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
        if (routeLayer) { 
            if (routeLayer.trafficMarkers) {
                routeLayer.trafficMarkers.forEach(m => map.removeLayer(m));
            }
            map.removeLayer(routeLayer); 
            routeLayer = null; 
        }
        
        startInput.innerHTML = START_PLACEHOLDER;
        endInput.innerHTML = END_PLACEHOLDER;
        selectionMode = 'start';
        updateSelectionModeDisplay();
        
        routeInfoDiv.style.display = 'none'; // Hide route info
        calculateRouteBtn.disabled = true;
        
        blockedRoads.forEach(r => map.removeLayer(r.marker)); 
        blockedRoads = [];
        updateBlockedRoadsList();
    }

    async function calculateOptimalRoute() {
        if (!startMarker || !endMarker) { alert('Please set both start and end points first.'); return; }
        calculateRouteBtn.textContent = 'Calculating...'; calculateRouteBtn.disabled = true;
        try {
            const s = startMarker.getLatLng(), e = endMarker.getLatLng();
            // Using OSRM (open-source routing)
            const url = `https://router.project-osrm.org/route/v1/driving/${s.lng},${s.lat};${e.lng},${e.lat}?overview=full&geometries=geojson`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('Routing server error ' + resp.status);
            const data = await resp.json();
            if (!data || data.code !== 'Ok' || !data.routes || data.routes.length === 0) throw new Error('Failed to calculate route');

            const route = data.routes[0];
            const pathPoints = route.geometry.coordinates.map(c => [c[1], c[0]]);

            let intersectsBlocked = false;
            const thresholdDeg = 0.0005;
            for (const b of blockedRoads) {
                for (const p of pathPoints) {
                    const dlat = Math.abs(b.latlng.lat - p[0]);
                    const dlng = Math.abs(b.latlng.lng - p[1]);
                    if (dlat <= thresholdDeg && dlng <= thresholdDeg) { intersectsBlocked = true; break; }
                }
                if (intersectsBlocked) break;
            }

            if (intersectsBlocked) {
                const simulated = generateSimulatedRoute(s, e, emergencyType, blockedRoads);
                const distKm = haversineDistance(s.lat, s.lng, e.lat, e.lng) * 1.4;
                let baseEta = (distKm / 50) * 60; 
                if (emergencyType === 'high') baseEta *= 0.7; else if (emergencyType === 'medium') baseEta *= 0.85;
                displayRoute(simulated);
                routeSummaryDiv.innerHTML = `<p><strong>Algorithm:</strong> Simulated (Detour)</p>
                    <p><strong>Distance (approx):</strong> ${distKm.toFixed(2)} km</p>
                    <p><strong>Priority:</strong> ${emergencyType.toUpperCase()}</p>`;
                etaDisplay.textContent = `ETA: ${Math.round(baseEta)} Min`;
                lastRouteDurationMinutes = baseEta;
            } else {
                const distance = route.distance;
                const duration = route.duration;
                let baseEta = duration / 60;
                if (emergencyType === 'high') baseEta *= 0.7; else if (emergencyType === 'medium') baseEta *= 0.85;
                displayRoute(pathPoints);
                routeSummaryDiv.innerHTML = `<p><strong>Algorithm:</strong> OSRM</p>
                    <p><strong>Distance:</strong> ${(distance / 1000).toFixed(2)} km</p>
                    <p><strong>Priority:</strong> ${emergencyType.toUpperCase()}</p>`;
                etaDisplay.textContent = `ETA: ${Math.round(baseEta)} Min`;
                lastRouteDurationMinutes = baseEta;
            }
            
            routeInfoDiv.style.display = 'block'; // Show info
            
        } catch (err) {
            console.error(err);
            alert(err.message || 'Routing failed');
        } finally {
            calculateRouteBtn.textContent = 'Calculate Optimal Route';
            calculateRouteBtn.disabled = false;
        }
    }

    function haversineDistance(lat1, lon1, lat2, lon2) {
        const toRad = x => x * Math.PI / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
        const a = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function generateSimulatedRoute(start, end, priority, blockedPoints) {
        const pts = [];
        const steps = 30;
        const curvature = priority === 'high' ? 0.001 : priority === 'medium' ? 0.002 : 0.003;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const lat = start.lat + (end.lat - start.lat) * t;
            const lng = start.lng + (end.lng - start.lng) * t + Math.sin(t * Math.PI) * curvature * (1 + i / steps);
            pts.push([lat, lng]);
        }
        if (blockedPoints && blockedPoints.length > 0) {
            blockedPoints.forEach(b => {
                let minIdx = 0, minD = Infinity;
                for (let i = 0; i < pts.length; i++) {
                    const d = Math.hypot(pts[i][0] - b.latlng.lat, pts[i][1] - b.latlng.lng);
                    if (d < minD) { minD = d; minIdx = i; }
                }
                const shiftLat = 0.002 + Math.random() * 0.001;
                const shiftLng = 0.002 + Math.random() * 0.001;
                if (minIdx > 0) { pts[minIdx - 1][0] += shiftLat; pts[minIdx - 1][1] += shiftLng; }
                pts[minIdx][0] += shiftLat; pts[minIdx][1] += shiftLng;
                if (minIdx < pts.length - 1) { pts[minIdx + 1][0] += shiftLat; pts[minIdx + 1][1] += shiftLng; }
            });
        }
        return pts;
    }

    function displayRoute(routePts) {
        if (routeLayer) {
            if (routeLayer.trafficMarkers) {
                routeLayer.trafficMarkers.forEach(m => map.removeLayer(m));
            }
            map.removeLayer(routeLayer);
        }
        routeLayer = L.polyline(routePts, { color: ROUTE_COLOR, weight: 6, opacity: 0.8, lineJoin: 'round', lineCap: 'round' }).addTo(map);
        try { 
            map.fitBounds(routeLayer.getBounds(), { 
                paddingTopLeft: [50, 400],
                paddingBottomRight: [50, 50]
            }); 
        } catch (e) { }
    }

    function toggleRoadBlockMode() {
        roadBlockMode = !roadBlockMode;
        blockRoadBtn.textContent = roadBlockMode ? 'Road Block Mode ACTIVE' : 'Enable Road Block Mode';
        blockRoadBtn.classList.toggle('active', roadBlockMode);
        
        blockedRoadsList.style.display = 'block'; // Always show list container
        if (blockedRoads.length === 0) {
            blockedRoadsList.innerHTML = '<strong>Blocked Roads:</strong><p>Click map to add blocked points.</p>';
        }
        updateBlockedRoadsList();
    }

    function addRoadBlock(latlng) {
        const blockId = new Date().getTime(); // Unique ID
        const marker = L.marker(latlng, { 
            draggable: true,
            icon: L.divIcon({
                className: 'road-block-marker', html: '<div style="background:#e74c3c;border-radius:50%;width:15px;height:15px;"></div>',
                iconSize: [24, 24], iconAnchor: [12, 12]
            }) 
        }).addTo(map).bindPopup(`Blocked Point`);
        
        // Add click listener to remove it
        marker.on('click', () => {
            removeRoadBlock(blockId);
        });

        blockedRoads.push({ id: blockId, marker: marker });
        updateBlockedRoadsList();
    }
    
    function removeRoadBlock(blockId) {
        const index = blockedRoads.findIndex(r => r.id === blockId);
        if (index > -1) {
            map.removeLayer(blockedRoads[index].marker);
            blockedRoads.splice(index, 1);
            updateBlockedRoadsList();
        }
    }

    function updateBlockedRoadsList() {
        if (!roadBlockMode) {
             blockedRoadsList.style.display = 'none';
             return;
        }
        
        blockedRoadsList.style.display = 'block';
        blockedRoadsList.innerHTML = '<strong>Blocked Roads:</strong>';
        
        if (blockedRoads.length === 0) { 
            blockedRoadsList.innerHTML += '<p>Click map to add blocked points.</p>'; 
            return; 
        }
        
        const ul = document.createElement('ul');
        blockedRoads.forEach((r, i) => {
            const li = document.createElement('li');
            const span = document.createElement('span');
            const pos = r.marker.getLatLng();
            span.textContent = `Pt ${i+1}: ${pos.lat.toFixed(3)}, ${pos.lng.toFixed(3)}`;
            
            const btn = document.createElement('button');
            btn.textContent = 'X';
            btn.classList.add('danger');
            btn.addEventListener('click', () => removeRoadBlock(r.id));
            
            li.appendChild(span); 
            li.appendChild(btn); 
            ul.appendChild(li);
        });
        blockedRoadsList.appendChild(ul);
    }

    function simulateTrafficConditions() {
        if (!routeLayer) { alert('No route to simulate traffic on.'); return; }
        
        // Clear old markers if they exist
        if (routeLayer.trafficMarkers) {
            routeLayer.trafficMarkers.forEach(m => map.removeLayer(m));
        }

        const orig = routeLayer.getLatLngs();
        const trafficMarkers = [];
        orig.forEach((pt, idx) => {
            if (idx < orig.length - 1 && Math.random() > 0.7) { 
                const next = orig[idx + 1];
                const midLat = (pt.lat + next.lat) / 2;
                const midLng = (pt.lng + next.lng) / 2;
                const trafficMarker = L.marker([midLat, midLng], { icon: L.divIcon({
                    className: 'traffic-marker', html: '<div style="background:#f39c12;border-radius:50%;width:12px;height:12px;"></div>',
                    iconSize: [16, 16], iconAnchor: [8, 8]
                }) }).addTo(map).bindPopup('Traffic Delay');
                trafficMarkers.push(trafficMarker);
            }
        });

        routeLayer.trafficMarkers = trafficMarkers; 
        
        let curEta = lastRouteDurationMinutes || 0;
        const newEta = Math.round(curEta + Math.random() * 5 + 2);
        
        etaDisplay.textContent = `ETA: ${newEta} Min (with traffic)`;
        routeSummaryDiv.innerHTML = routeSummaryDiv.innerHTML.split('<p><strong>Note:')[0]; // Clear old note
        routeSummaryDiv.innerHTML += `<p><strong>Note:</strong> Simulated traffic delays added</p>`;
        lastRouteDurationMinutes = newEta;

        setTimeout(() => {
            trafficMarkers.forEach(marker => map.removeLayer(marker));
        }, 5000);
    }
 
    // Initialize UI
    updateSelectionModeDisplay();
    calculateRouteBtn.disabled = true;
    const defaultHigh = document.querySelector('.emergency-option[data-type="high"]');
    if (defaultHigh) defaultHigh.classList.add('selected');
});