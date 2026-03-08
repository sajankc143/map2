let map;
let observations = [];
let markers = [];
let markerGroup;
let isLoading = false;
let geocoder = null;
let isViewingSingleObservation = false;

// ----------------------------------------------------------------
// AREA SELECTION
// ----------------------------------------------------------------
let selectionLayer = null;
let drawnItems = null;
let isSelectionMode = false;

const sourceUrls = [
    "https://www.butterflyexplorers.com/p/new-butterflies.html",
];

function showObservationOnMap(observationData) {
    if (!map || !observationData) return;
    isViewingSingleObservation = true;
    console.log('Showing single observation on map');
    const coords = parseCoordinates(observationData.originalTitle || observationData.fullTitle);
    if (!coords) {
        console.log('No coordinates found for this observation');
        isViewingSingleObservation = false;
        return;
    }
    clearMap();
    const markerRadius = getMarkerRadius();
    const marker = L.circleMarker(coords, {
        radius: markerRadius + 2,
        fillColor: '#ff0000',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
        interactive: true
    });
    const popupContent = `
        <div>
            <div class="popup-species">${observationData.species}</div>
            <div class="popup-common">${observationData.commonName}</div>
            ${observationData.thumbnailUrl ? `<img src="${observationData.thumbnailUrl}" class="popup-image" alt="${observationData.species}" onerror="this.style.display='none'">` : ''}
            <div class="popup-location">📍 ${observationData.location || 'Location not specified'}</div>
            ${observationData.date ? `<div class="popup-date">📅 ${new Date(observationData.date).toLocaleDateString()}</div>` : ''}
        </div>
    `;
    marker.bindPopup(popupContent, {
        maxWidth: 300,
        closeButton: true,
        autoPan: true,
        keepInView: true,
        className: 'custom-popup'
    });
    marker.addTo(markerGroup);
    map.setView(coords, 12);
    marker.openPopup();
    console.log(`Map centered on observation: ${observationData.species} at`, coords);
}

function initMap() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    map = L.map('map', {
        preferCanvas: true,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        tap: true,
        touchZoom: true,
        tapTolerance: isTouchDevice ? 20 : 10,
        maxTouchPoints: 2,
        bounceAtZoomLimits: false,
        zoomSnap: isTouchDevice ? 0.5 : 1,
        zoomDelta: isTouchDevice ? 0.5 : 1
    }).setView([39.8283, -98.5795], 4);

    const baseLayers = {
        "Normal": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18, updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 2
        }),
        "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, Maxar, Earthstar Geographics',
            maxZoom: 18, updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 2
        }),
        "Terrain": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap contributors',
            maxZoom: 17, updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 2
        }),
        "Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© CartoDB contributors',
            maxZoom: 19, updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 2
        })
    };

    baseLayers["Normal"].addTo(map);
    L.control.layers(baseLayers, null, { position: 'topright', collapsed: false }).addTo(map);

    const mapToggleControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            container.style.cssText = `
                background: rgba(255,255,255,0.9); width: 120px; height: 40px;
                border-radius: 8px; cursor: pointer; display: flex;
                align-items: center; justify-content: center; font-weight: bold;
                font-size: 12px; color: #333; backdrop-filter: blur(10px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: all 0.3s ease;
            `;
            container.innerHTML = '🗺️ Normal';
            let currentLayer = 'Normal';
            container.onclick = function() {
                const layerKeys = Object.keys(baseLayers);
                const nextLayer = layerKeys[(layerKeys.indexOf(currentLayer) + 1) % layerKeys.length];
                map.removeLayer(baseLayers[currentLayer]);
                map.addLayer(baseLayers[nextLayer]);
                currentLayer = nextLayer;
                const icons = { 'Normal': '🗺️', 'Satellite': '🛰️', 'Terrain': '🏔️', 'Dark': '🌙' };
                container.innerHTML = `${icons[nextLayer]} ${nextLayer}`;
                container.style.background = nextLayer === 'Dark' ? 'rgba(50,50,50,0.9)' : 'rgba(255,255,255,0.9)';
                container.style.color = nextLayer === 'Dark' ? '#fff' : '#333';
            };
            L.DomEvent.disableClickPropagation(container);
            return container;
        }
    });
    map.addControl(new mapToggleControl());

    markerGroup = L.layerGroup().addTo(map);
    map.on('zoomend', updateMarkerSizes);

    const speciesFilter = document.getElementById('speciesFilter');
    if (speciesFilter) speciesFilter.addEventListener('input', filterObservations);

    initializeLocationSearchControls();
    initAreaSelection();  // <-- AREA SELECTION
}

// ----------------------------------------------------------------
// AREA SELECTION FUNCTIONS
// ----------------------------------------------------------------

function initAreaSelection() {
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: {
            rectangle: {
                shapeOptions: { color: '#2980b9', fillColor: '#2980b9', fillOpacity: 0.15, weight: 2 }
            },
            polygon: {
                shapeOptions: { color: '#2980b9', fillColor: '#2980b9', fillOpacity: 0.15, weight: 2 }
            },
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false
        },
        edit: { featureGroup: drawnItems, remove: true }
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, function(e) {
        drawnItems.clearLayers();
        selectionLayer = e.layer;
        drawnItems.addLayer(selectionLayer);
        filterGalleryByBounds(selectionLayer);
    });

    map.on(L.Draw.Event.DELETED, function() {
        selectionLayer = null;
        clearAreaSelection();
    });

    addClearSelectionButton();
}

function filterGalleryByBounds(layer) {
    if (!infiniteGalleryUpdater) return;
    const bounds = layer.getBounds();
    const filtered = infiniteGalleryUpdater.allImages.filter(img => {
        const coords = parseCoordinates(img.originalTitle || img.fullTitle);
        if (!coords) return false;
        return bounds.contains(L.latLng(coords[0], coords[1]));
    });
    infiniteGalleryUpdater.filteredImages = filtered;
    infiniteGalleryUpdater.displayImages();
    showSelectionBadge(filtered.length);
    console.log(`Area selection: ${filtered.length} observations in bounds`);
}

function clearAreaSelection() {
    if (drawnItems) drawnItems.clearLayers();
    selectionLayer = null;
    if (infiniteGalleryUpdater) infiniteGalleryUpdater.applyFilters();
    hideSelectionBadge();
}

function showSelectionBadge(count) {
    let badge = document.getElementById('selectionBadge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'selectionBadge';
        badge.style.cssText = `
            position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
            background: rgba(20,20,40,0.75); border: 1px solid rgba(255,255,255,0.2);
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            color: #fff; padding: 10px 20px; border-radius: 24px;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
            font-size: 14px; font-weight: 500; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 9000; display: flex; align-items: center; gap: 12px;
            animation: slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1);
        `;
        document.body.appendChild(badge);
    }
    badge.innerHTML = `
        📍 <strong>${count}</strong> observation${count !== 1 ? 's' : ''} in selected area
        <button onclick="clearAreaSelection()" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:#fff;border-radius:12px;padding:4px 12px;font-size:13px;cursor:pointer;">Clear</button>
    `;
    badge.style.display = 'flex';
}

function hideSelectionBadge() {
    const badge = document.getElementById('selectionBadge');
    if (badge) badge.style.display = 'none';
}

function addClearSelectionButton() {
    const ClearControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function() {
            const btn = L.DomUtil.create('button', '');
            btn.style.cssText = `
                background: rgba(231,76,60,0.3); border: 1px solid rgba(231,76,60,0.5);
                border-radius: 8px; color: white; padding: 6px 12px; font-size: 12px;
                font-weight: 500; cursor: pointer; backdrop-filter: blur(10px);
                display: none; white-space: nowrap;
            `;
            btn.id = 'clearSelectionBtn';
            btn.innerHTML = '✕ Clear Selection';
            btn.onclick = clearAreaSelection;
            L.DomEvent.disableClickPropagation(btn);
            return btn;
        }
    });
    map.addControl(new ClearControl());
}

// ----------------------------------------------------------------
// RESET / SYNC
// ----------------------------------------------------------------

function resetMapToAllObservations() {
    if (!map) return;
    isViewingSingleObservation = false;
    if (typeof infiniteGalleryUpdater !== 'undefined' &&
        infiniteGalleryUpdater.filteredImages &&
        infiniteGalleryUpdater.filteredImages.length > 0) {
        syncMapWithSearchResults(infiniteGalleryUpdater.filteredImages);
    } else if (observations && observations.length > 0) {
        displayObservations();
    } else {
        clearMap();
    }
}

function syncMapWithSearchResults(searchFilteredImages) {
    isViewingSingleObservation = false;
    observations = [];
    searchFilteredImages.forEach(image => {
        const coords = parseCoordinates(image.originalTitle || image.fullTitle);
        if (coords) {
            observations.push({
                species: image.species,
                commonName: image.commonName,
                coordinates: coords,
                location: image.location || '',
                date: image.date || '',
                photographer: '',
                imageUrl: image.thumbnailUrl,
                fullImageUrl: image.fullImageUrl,
                sourceUrl: image.sourceUrl,
                originalTitle: image.originalTitle || image.fullTitle
            });
        }
    });
    displayObservations();
    console.log(`Map synced with ${observations.length} observations from search results`);
}

function initializeLocationSearchControls() {
    const topControlsContainer = document.querySelector('.top-controls');
    if (topControlsContainer) {
        topControlsContainer.insertAdjacentHTML('beforeend', `
            <div class="control-group">
                <label>Go to Location</label>
                <div style="display: flex; gap: 5px;">
                    <input type="text" id="locationInput" placeholder="Enter city, state, or coordinates..." style="flex: 1;" />
                    <button onclick="searchByLocation()" style="padding: 8px 12px;">Go</button>
                </div>
                <div id="locationResults" style="font-size: 12px; color: #666; min-height: 20px; margin-top: 5px;"></div>
            </div>
        `);
        const locationInput = document.getElementById('locationInput');
        if (locationInput) {
            locationInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') searchByLocation();
            });
        }
    }
}

async function searchByLocation() {
    const input = document.getElementById('locationInput');
    const query = input.value.trim();
    if (!query) { alert('Please enter a location'); return; }
    const coordMatch = query.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            goToLocation(lat, lng, query); return;
        }
    }
    try {
        showLocationResults('Searching for location...');
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
            goToLocation(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].display_name);
        } else {
            showLocationResults('Location not found. Try coordinates (lat, lng).');
        }
    } catch (error) {
        showLocationResults('Error searching. Try coordinates (lat, lng) format.');
    }
}

function goToLocation(lat, lng, locationName = null) {
    map.setView([lat, lng], 10);
    showLocationResults(`Moved to: ${locationName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}`);
    setTimeout(() => showLocationResults(''), 3000);
}

function showLocationResults(html) {
    const resultsDiv = document.getElementById('locationResults');
    if (resultsDiv) resultsDiv.innerHTML = html;
}

// ----------------------------------------------------------------
// COORDINATE PARSING
// ----------------------------------------------------------------

function parseCoordinates(text) {
    if (!text) return null;
    const decodedText = text
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"').replace(/&#176;/g, '°');
    const coordPatterns = [
        /\(([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])\s*([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])[^)]*\)/,
        /\(([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])\s+([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])[^)]*\)/,
        /([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])\s+([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])/,
        /([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])/,
        /\(([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([NS])\s*,?\s*([0-9]+)°([0-9]+)'([0-9]+(?:\.[0-9]+)?)''([EW])/,
        /\(([0-9.-]+)[°\s]*([NS])[,\s]+([0-9.-]+)[°\s]*([EW])/,
        /([0-9.-]+)[°\s]*([NS])[,\s]+([0-9.-]+)[°\s]*([EW])/,
        /\(?(-?[0-9]+\.[0-9]+)\s*,\s*(-?[0-9]+\.[0-9]+)\)?/,
        /\((-?[0-9]+\.[0-9]+)\s*,\s*(-?[0-9]+\.[0-9]+)\)/,
        /(-?[0-9]+\.[0-9]+)\s+(-?[0-9]+\.[0-9]+)/,
        /([0-9]+(?:\.[0-9]+)?)[°\s]*[NS]?[,\s]+([0-9]+(?:\.[0-9]+)?)[°\s]*[EW]?/
    ];
    for (let pattern of coordPatterns) {
        const match = decodedText.match(pattern);
        if (match) {
            if (match.length >= 8) {
                let lat = parseInt(match[1]) + parseInt(match[2])/60 + parseFloat(match[3])/3600;
                let lon = parseInt(match[5]) + parseInt(match[6])/60 + parseFloat(match[7])/3600;
                if (match[4] === 'S') lat = -lat;
                if (match[8] === 'W') lon = -lon;
                return [lat, lon];
            } else if (match.length >= 4) {
                let lat = parseFloat(match[1]);
                let lon = parseFloat(match[3]);
                if (match[2] === 'S') lat = -lat;
                if (match[4] === 'W') lon = -lon;
                return [lat, lon];
            } else if (match.length >= 3) {
                const lat = parseFloat(match[1]);
                const lon = parseFloat(match[2]);
                if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) return [lat, lon];
            }
        }
    }
    return null;
}

// ----------------------------------------------------------------
// EXTRACT OBSERVATIONS
// ----------------------------------------------------------------

function extractObservations(htmlContent, sourceUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const foundObservations = [];
    const imageLinks = doc.querySelectorAll('a[data-title]');
    console.log(`Found ${imageLinks.length} image links in ${getPageName(sourceUrl)}`);
    imageLinks.forEach((link, index) => {
        const dataTitle = link.getAttribute('data-title');
        const img = link.querySelector('img');
        if (dataTitle && img) {
            const decodedTitle = dataTitle.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
            let speciesMatch = decodedTitle.match(/<p4><i>(.*?)<\/i>\s*[-–]\s*([^<]+?)<\/a><\/p4>/) ||
                               decodedTitle.match(/<p4><i>(.*?)<\/i>\s*[-–]\s*([^<]+)<\/p4>/) ||
                               decodedTitle.match(/<i>(.*?)<\/i>\s*[-–]\s*([^<]+?)(?:<br|$)/);
            let species = 'Unknown Species', commonName = 'Unknown';
            if (speciesMatch) { species = speciesMatch[1].trim(); commonName = speciesMatch[2].trim(); }
            const coordinates = parseCoordinates(decodedTitle);
            if (coordinates) {
                let location = '';
                for (let pattern of [/<br\/?>\s*([^(]+?)(?:\s+\([0-9])/, /<br\/?>\s*([^(]+?)$/, /<br\/?>\s*([^<]+?)\s+\d{4}\/\d{2}\/\d{2}/]) {
                    const m = decodedTitle.match(pattern);
                    if (m) { location = m[1].trim(); break; }
                }
                const dateMatch = decodedTitle.match(/(\d{4}\/\d{2}\/\d{2})/);
                const photoMatch = decodedTitle.match(/©\s*([^&]+(?:&[^&]+)*)/);
                foundObservations.push({
                    species, commonName, coordinates, location,
                    date: dateMatch ? dateMatch[1] : '',
                    photographer: photoMatch ? photoMatch[1].trim() : '',
                    imageUrl: img.getAttribute('src'),
                    fullImageUrl: link.getAttribute('href'),
                    sourceUrl,
                    originalTitle: decodedTitle
                });
            }
        }
    });
    console.log(`Extracted ${foundObservations.length} observations from ${getPageName(sourceUrl)}`);
    return foundObservations;
}

// ----------------------------------------------------------------
// LOAD OBSERVATIONS
// ----------------------------------------------------------------

async function loadObservations() {
    if (isLoading) return;
    isLoading = true;
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) { loadingDiv.style.display = 'block'; loadingDiv.textContent = 'Loading butterfly observations...'; }
    observations = [];
    clearMap();

    const proxyServices = [
        { url: 'https://corsproxy.io/?', type: 'text' },
        { url: 'https://api.allorigins.win/get?url=', type: 'json' },
        { url: 'https://api.codetabs.com/v1/proxy?quest=', type: 'text' },
        { url: 'https://thingproxy.freeboard.io/fetch/', type: 'text' }
    ];

    async function fetchWithFallbacks(url) {
        for (const proxy of proxyServices) {
            for (let retry = 0; retry < 2; retry++) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 20000);
                    const response = await fetch(proxy.url + encodeURIComponent(url), { signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (response.ok) {
                        let content = proxy.type === 'json' ? (await response.json()).contents : await response.text();
                        if (content && content.length > 1000) return content;
                    }
                } catch (e) {
                    if (retry < 1) await new Promise(r => setTimeout(r, 1000 + retry * 1000));
                }
            }
        }
        throw new Error('All proxies failed');
    }

    let totalLoaded = 0;
    const errors = [];
    for (let i = 0; i < sourceUrls.length; i++) {
        const url = sourceUrls[i];
        if (loadingDiv) loadingDiv.textContent = `Loading ${getPageName(url)}... (${i+1}/${sourceUrls.length})`;
        try {
            const html = await fetchWithFallbacks(url);
            const siteObs = extractObservations(html, url);
            observations.push(...siteObs);
            totalLoaded += siteObs.length;
        } catch (e) {
            errors.push(`${getPageName(url)}: ${e.message}`);
        }
        if (i < sourceUrls.length - 1) await new Promise(r => setTimeout(r, 1000));
    }

    if (loadingDiv) loadingDiv.style.display = 'none';

    if (errors.length > 0) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'background:#fff3cd;border:1px solid #ffeaa7;color:#856404;padding:10px;margin:10px 0;border-radius:4px;position:relative;';
        errorDiv.innerHTML = `<strong>Some pages couldn't be loaded:</strong><br>${errors.join('<br>')}<br><small>Showing ${totalLoaded} observations.</small><button onclick="this.parentElement.remove()" style="position:absolute;top:5px;right:10px;background:none;border:none;font-size:16px;cursor:pointer;">×</button>`;
        const container = document.querySelector('.container');
        if (container) container.insertBefore(errorDiv, document.getElementById('map'));
        setTimeout(() => { if (errorDiv.parentElement) errorDiv.remove(); }, 15000);
    }

    displayObservations();
    isLoading = false;

    if (totalLoaded === 0 && loadingDiv) {
        loadingDiv.style.display = 'block';
        loadingDiv.innerHTML = `<div style="color:#856404;">No observations loaded. <button onclick="loadObservations()" style="margin-left:10px;padding:5px 10px;background:#007bff;color:white;border:none;border-radius:3px;cursor:pointer;">Try Again</button></div>`;
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('obs')) {
        if (typeof infiniteGalleryUpdater !== 'undefined' &&
            infiniteGalleryUpdater.filteredImages &&
            infiniteGalleryUpdater.currentSearchParams &&
            !isViewingSingleObservation) {
            syncMapWithSearchResults(infiniteGalleryUpdater.filteredImages);
        }
    }
}

// ----------------------------------------------------------------
// DISPLAY OBSERVATIONS
// ----------------------------------------------------------------

function displayObservations() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('obs') || isViewingSingleObservation) return;
    markerGroup.clearLayers();
    const filteredObs = getCurrentFilteredObservations();
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    filteredObs.forEach(obs => {
        const marker = L.circleMarker(obs.coordinates, {
            radius: getMarkerRadius(),
            fillColor: '#ff6b35', color: '#ffffff',
            weight: isTouchDevice ? 3 : 2,
            opacity: 1, fillOpacity: 0.95,
            interactive: true, bubblingMouseEvents: false, pane: 'markerPane'
        });
        marker.bindPopup(`
            <div>
                <div class="popup-species">${obs.species}</div>
                <div class="popup-common">${obs.commonName}</div>
                ${obs.imageUrl ? `<img src="${obs.imageUrl}" class="popup-image" alt="${obs.species}" onerror="this.style.display='none'">` : ''}
                <div class="popup-location">📍 ${obs.location}</div>
                ${obs.date ? `<div class="popup-date">📅 ${obs.date}</div>` : ''}
                ${obs.photographer ? `<div class="popup-date">📷 ${obs.photographer}</div>` : ''}
            </div>
        `, { maxWidth: isTouchDevice ? 280 : 300, closeButton: true, autoPan: true, keepInView: true, className: 'custom-popup', autoPanPadding: [10,10], closeOnClick: true, closeOnEscapeKey: true });
        marker.on('click', function() { if (!this.isPopupOpen()) this.openPopup(); });
        if (isTouchDevice) {
            marker.on('touchstart', function() { const self = this; setTimeout(() => { if (!self.isPopupOpen()) self.openPopup(); }, 100); });
        }
        marker._butterflyMarker = true;
        marker.addTo(markerGroup);
    });
    if (filteredObs.length > 0) {
        map.fitBounds(new L.featureGroup(markerGroup.getLayers()).getBounds().pad(0.1));
    }
    updateStats();
}

function getMarkerRadius() {
    if (!map) return 8;
    const zoom = map.getZoom();
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
        if (zoom <= 4) return 10; else if (zoom <= 6) return 11; else if (zoom <= 8) return 12;
        else if (zoom <= 10) return 14; else if (zoom <= 12) return 16; else if (zoom <= 14) return 18;
        else if (zoom <= 16) return 20; else return 22;
    } else {
        if (zoom <= 4) return 6; else if (zoom <= 6) return 7; else if (zoom <= 8) return 8;
        else if (zoom <= 10) return 9; else if (zoom <= 12) return 10; else if (zoom <= 14) return 11;
        else return 12;
    }
}

function updateMarkerSizes() {
    const newRadius = getMarkerRadius();
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    markerGroup.eachLayer(function(marker) {
        if (marker._butterflyMarker && marker.setRadius) {
            marker.setStyle({ radius: newRadius, weight: isTouchDevice ? 3 : 2 });
        }
    });
}

function filterObservations() { displayObservations(); }

function getCurrentFilteredObservations() {
    const speciesFilterElement = document.getElementById('speciesFilter');
    const speciesFilter = speciesFilterElement ? speciesFilterElement.value.toLowerCase() : '';
    if (!speciesFilter) return observations;
    return observations.filter(obs =>
        obs.species.toLowerCase().includes(speciesFilter) ||
        obs.commonName.toLowerCase().includes(speciesFilter)
    );
}

function clearMap() {
    if (markerGroup) markerGroup.clearLayers();
    updateStats();
}

function updateStats() {
    const filteredObs = getCurrentFilteredObservations();
    const uniqueSpecies = new Set(filteredObs.map(o => o.species)).size;
    const uniqueLocations = new Set(filteredObs.map(o => o.location)).size;
    const sourceCounts = {};
    observations.forEach(o => { const p = getPageName(o.sourceUrl); sourceCounts[p] = (sourceCounts[p] || 0) + 1; });
    const statsElement = document.getElementById('stats');
    if (statsElement) {
        statsElement.innerHTML = `
            <div class="stat-card"><div class="stat-number">${filteredObs.length}</div><div class="stat-label">Total Observations</div></div>
            <div class="stat-card"><div class="stat-number">${uniqueSpecies}</div><div class="stat-label">Unique Species</div></div>
            <div class="stat-card"><div class="stat-number">${uniqueLocations}</div><div class="stat-label">Unique Locations</div></div>
            <div class="stat-card"><div class="stat-number">${Object.keys(sourceCounts).length}</div><div class="stat-label">Source Pages</div></div>
        `;
    }
}

function getPageName(url) {
    const pageNames = {
        'butterflies-of-texas.html': 'Texas', 'butterflies-of-puerto-rico.html': 'Puerto Rico',
        'butterflies-of-new-mexico.html': 'New Mexico', 'butterflies-of-arizona.html': 'Arizona',
        'butterflies-of-panama.html': 'Panama', 'butterflies-of-florida.html': 'Florida',
        'new-butterflies.html': 'New Butterflies', 'dual-checklist.html': 'Dual Checklist'
    };
    for (const [key, name] of Object.entries(pageNames)) { if (url.includes(key)) return name; }
    return 'Unknown';
}

function autoClickLoadButton() {
    const buttons = document.querySelectorAll('button');
    for (let button of buttons) {
        if ((button.onclick && button.onclick.toString().includes('loadObservations')) ||
            (button.getAttribute('onclick') && button.getAttribute('onclick').includes('loadObservations')) ||
            button.textContent.includes('Load') || button.textContent.includes('Refresh')) {
            button.click(); return true;
        }
    }
    return false;
}

function initializeMapSimple() {
    if (typeof map === 'undefined') {
        const mapDiv = document.getElementById('map');
        if (mapDiv && typeof L !== 'undefined') { initMap(); } else return false;
    }
    if (observations.length === 0 && !isLoading) return autoClickLoadButton();
    return true;
}

if (document.readyState !== 'loading') setTimeout(initializeMapSimple, 500);
document.addEventListener('DOMContentLoaded', () => setTimeout(initializeMapSimple, 500));
window.addEventListener('load', () => setTimeout(initializeMapSimple, 500));
setTimeout(() => initializeMapSimple(), 2000);
setTimeout(() => initializeMapSimple(), 4000);
setTimeout(() => initializeMapSimple(), 7000);

function refreshMap() { loadObservations(); }

function debugGitHub() {
    console.log('=== DEBUG ===');
    console.log('Leaflet:', typeof L !== 'undefined');
    console.log('Map:', !!document.getElementById('map'));
    console.log('Observations:', observations.length);
}
setTimeout(debugGitHub, 3000);
