let map;
let observations = [];
let markers = [];
let markerGroup;
let isLoading = false;
let geocoder = null;
let isViewingSingleObservation = false;
let selectionRectangle = null;
let selectionPolygon = null;
let isDrawingSelection = false;
let selectionStartPoint = null;
let mapBoundsFilter = null;
let activeSelectionMode = null;
let polygonPoints = [];
let polygonPolyline = null;
let polygonClickHandlers = null;

const sourceUrls = [
    "https://www.butterflyexplorers.com/p/new-butterflies.html",
];

// ── BOUNDS SELECTION TOOL ─────────────────────────────────────────

function initBoundsSelectionTool() {
    const rectBtn = document.getElementById('bounds-rect-btn');
    const polyBtn = document.getElementById('bounds-poly-btn');
    const clearBtn = document.getElementById('bounds-clear-btn');

    if (rectBtn) rectBtn.addEventListener('click', () => {
        if (activeSelectionMode === 'rectangle') {
            exitSelectionMode();
        } else {
            exitSelectionMode();
            enterRectangleMode();
        }
    });

    if (polyBtn) polyBtn.addEventListener('click', () => {
        if (activeSelectionMode === 'polygon') {
            exitSelectionMode();
        } else {
            exitSelectionMode();
            enterPolygonMode();
        }
    });

    if (clearBtn) clearBtn.addEventListener('click', clearBoundsFilter);
}

function enterRectangleMode() {
    activeSelectionMode = 'rectangle';
    map.dragging.disable();
    map.getContainer().style.cursor = 'crosshair';
    setButtonActive('bounds-rect-btn', true);

    let startLatLng = null;

    function onMouseDown(e) {
        startLatLng = e.latlng;
        clearSelectionShapes();
    }

    function onMouseMove(e) {
        if (!startLatLng) return;
        if (selectionRectangle) map.removeLayer(selectionRectangle);
        selectionRectangle = L.rectangle([startLatLng, e.latlng], {
            color: '#3498db',
            weight: 2,
            fillColor: '#3498db',
            fillOpacity: 0.15,
            dashArray: '6, 4'
        }).addTo(map);
    }

    function onMouseUp(e) {
        if (!startLatLng) return;

        const tooSmall = Math.abs(startLatLng.lat - e.latlng.lat) < 0.001 &&
                         Math.abs(startLatLng.lng - e.latlng.lng) < 0.001;
        if (tooSmall) { startLatLng = null; return; }

        const bounds = L.latLngBounds(startLatLng, e.latlng);
        startLatLng = null;
        mapBoundsFilter = { type: 'rectangle', bounds };

        exitSelectionMode();
        applyBoundsFilterToGallery();
        showClearButton();
    }

    map._rectHandlers = { onMouseDown, onMouseMove, onMouseUp };
    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
}

function enterPolygonMode() {
    activeSelectionMode = 'polygon';
    map.dragging.disable();
    map.getContainer().style.cursor = 'crosshair';
    setButtonActive('bounds-poly-btn', true);
    polygonPoints = [];

    showMapTooltip('Click to add points. Double-click to close polygon.');

    function onMapClick(e) {
        polygonPoints.push(e.latlng);

        if (polygonPolyline) map.removeLayer(polygonPolyline);
        if (polygonPoints.length > 1) {
            polygonPolyline = L.polyline(polygonPoints, {
                color: '#e67e22',
                weight: 2,
                dashArray: '6, 4'
            }).addTo(map);
        } else {
            polygonPolyline = L.circleMarker(e.latlng, {
                radius: 5,
                color: '#e67e22',
                fillColor: '#e67e22',
                fillOpacity: 1
            }).addTo(map);
        }
    }

    function onMapDblClick(e) {
        if (polygonPoints.length < 3) {
            showMapTooltip('Need at least 3 points to close a polygon.', 2000);
            return;
        }

        if (polygonPolyline) { map.removeLayer(polygonPolyline); polygonPolyline = null; }
        clearSelectionShapes();

        selectionPolygon = L.polygon(polygonPoints, {
            color: '#e67e22',
            weight: 2,
            fillColor: '#e67e22',
            fillOpacity: 0.15,
            dashArray: '6, 4'
        }).addTo(map);

        mapBoundsFilter = { type: 'polygon', points: [...polygonPoints] };
        polygonPoints = [];

        exitSelectionMode();
        applyBoundsFilterToGallery();
        showClearButton();
        hideMapTooltip();
    }

    polygonClickHandlers = { onMapClick, onMapDblClick };
    map.on('click', onMapClick);
    map.on('dblclick', onMapDblClick);
}

function exitSelectionMode() {
    if (map._rectHandlers) {
        map.off('mousedown', map._rectHandlers.onMouseDown);
        map.off('mousemove', map._rectHandlers.onMouseMove);
        map.off('mouseup', map._rectHandlers.onMouseUp);
        map._rectHandlers = null;
    }

    if (polygonClickHandlers) {
        map.off('click', polygonClickHandlers.onMapClick);
        map.off('dblclick', polygonClickHandlers.onMapDblClick);
        polygonClickHandlers = null;
    }

    if (polygonPolyline) { map.removeLayer(polygonPolyline); polygonPolyline = null; }
    polygonPoints = [];

    activeSelectionMode = null;
    isDrawingSelection = false;
    map.dragging.enable();
    map.getContainer().style.cursor = '';
    hideMapTooltip();

    setButtonActive('bounds-rect-btn', false);
    setButtonActive('bounds-poly-btn', false);
}

// ── THE KEY FUNCTION: filter allImages by bounds, then push to gallery ──
function applyBoundsFilterToGallery() {
    if (!mapBoundsFilter) return;

    // Get allImages — try gallery updater first, fall back to map observations
    let sourceImages = [];
    if (window.infiniteGalleryUpdater && infiniteGalleryUpdater.allImages && infiniteGalleryUpdater.allImages.length > 0) {
        sourceImages = infiniteGalleryUpdater.allImages;
    } else {
        console.warn('infiniteGalleryUpdater.allImages not available');
        return;
    }

    const filtered = sourceImages.filter(image => {
        const coords = parseCoordinates(image.originalTitle || image.fullTitle || '');
        if (!coords) return false;
        const latlng = L.latLng(coords[0], coords[1]);
        if (mapBoundsFilter.type === 'rectangle') {
            return mapBoundsFilter.bounds.contains(latlng);
        } else if (mapBoundsFilter.type === 'polygon') {
            return pointInPolygon(latlng, mapBoundsFilter.points);
        }
        return false;
    });

    console.log(`Bounds filter: ${filtered.length} of ${sourceImages.length} observations in selected area`);

    // Directly mutate the gallery state and force a re-render
    infiniteGalleryUpdater.currentView = 'all';
    infiniteGalleryUpdater.currentSpecies = null;
    infiniteGalleryUpdater.currentPage = 1;
    infiniteGalleryUpdater.currentSearchParams = { mapBoundsActive: true };
    infiniteGalleryUpdater.filteredImages = filtered;

    // Force full container re-render (not just results)
    infiniteGalleryUpdater.updateInfiniteGalleryContainer();

    // Also sync map markers to only show filtered
    syncMapWithSearchResults(filtered);

    // Scroll gallery into view
    setTimeout(() => {
        const container = document.querySelector('#infinite-gallery-container');
        if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
}

function pointInPolygon(latlng, polygonLatLngs) {
    const x = latlng.lng, y = latlng.lat;
    let inside = false;
    for (let i = 0, j = polygonLatLngs.length - 1; i < polygonLatLngs.length; j = i++) {
        const xi = polygonLatLngs[i].lng, yi = polygonLatLngs[i].lat;
        const xj = polygonLatLngs[j].lng, yj = polygonLatLngs[j].lat;
        const intersect = ((yi > y) !== (yj > y)) &&
                          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function clearBoundsFilter() {
    mapBoundsFilter = null;
    clearSelectionShapes();
    hideClearButton();

    if (!window.infiniteGalleryUpdater) return;

    infiniteGalleryUpdater.currentView = 'all';
    infiniteGalleryUpdater.currentSpecies = null;
    infiniteGalleryUpdater.currentSearchParams = null;
    infiniteGalleryUpdater.filteredImages = [...infiniteGalleryUpdater.allImages];
    infiniteGalleryUpdater.currentPage = 1;

    // Reset search form
    ['species-search', 'location-search'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const familyEl = document.getElementById('family-search');
    if (familyEl) familyEl.value = 'all';
    const dateEl = document.getElementById('date-filter-type');
    if (dateEl) dateEl.value = 'all';

    infiniteGalleryUpdater.updateInfiniteGalleryContainer();
    syncMapWithSearchResults(infiniteGalleryUpdater.filteredImages);
}

function clearSelectionShapes() {
    if (selectionRectangle) { map.removeLayer(selectionRectangle); selectionRectangle = null; }
    if (selectionPolygon)   { map.removeLayer(selectionPolygon);   selectionPolygon = null; }
}

// ── UI HELPERS ────────────────────────────────────────────────────

function setButtonActive(id, active) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.style.background = active ? 'rgba(231, 76, 60, 0.85)' : 'rgba(255,255,255,0.15)';
}

function showClearButton() {
    const btn = document.getElementById('bounds-clear-btn');
    if (btn) btn.style.display = 'inline-block';
}

function hideClearButton() {
    const btn = document.getElementById('bounds-clear-btn');
    if (btn) btn.style.display = 'none';
}

function showMapTooltip(text, autoDismissMs = null) {
    let tip = document.getElementById('map-draw-tooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'map-draw-tooltip';
        tip.style.cssText = `
            position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.75); color: #fff; padding: 8px 16px;
            border-radius: 12px; font-size: 13px; font-weight: 500;
            pointer-events: none; z-index: 1000; white-space: nowrap;
            backdrop-filter: blur(10px);
        `;
        document.getElementById('map').appendChild(tip);
    }
    tip.textContent = text;
    tip.style.display = 'block';
    if (autoDismissMs) setTimeout(hideMapTooltip, autoDismissMs);
}

function hideMapTooltip() {
    const tip = document.getElementById('map-draw-tooltip');
    if (tip) tip.style.display = 'none';
}

// ── SINGLE OBSERVATION ────────────────────────────────────────────

function showObservationOnMap(observationData) {
    if (!map || !observationData) return;

    isViewingSingleObservation = true;

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
}

// ── MAP INIT ──────────────────────────────────────────────────────

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
            maxZoom: 18,
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2
        }),
        "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, Maxar, Earthstar Geographics',
            maxZoom: 18,
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2
        }),
        "Terrain": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap contributors',
            maxZoom: 17,
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2
        }),
        "Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© CartoDB contributors',
            maxZoom: 19,
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2
        })
    };

    baseLayers["Normal"].addTo(map);

    L.control.layers(baseLayers, null, {
        position: 'topright',
        collapsed: false
    }).addTo(map);

    // Map type toggle button
    const mapToggleControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            container.style.cssText = `
                background: rgba(255, 255, 255, 0.9);
                width: 120px; height: 40px; border-radius: 8px; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                font-weight: bold; font-size: 12px; color: #333;
                backdrop-filter: blur(10px); box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                transition: all 0.3s ease;
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

    // Bounds selection buttons
    const boundsSelectControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function() {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            container.style.cssText = 'display:flex; flex-direction:column; gap:4px; background:none; border:none; box-shadow:none;';
            const btnStyle = `
                border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; color: white;
                padding: 8px 12px; cursor: pointer; font-size: 13px; font-weight: 600;
                backdrop-filter: blur(10px); white-space: nowrap;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: background 0.2s ease;
            `;
            container.innerHTML = `
                <button id="bounds-rect-btn" title="Drag to select rectangular area" style="background:rgba(255,255,255,0.15);${btnStyle}">⬚ Rectangle</button>
                <button id="bounds-poly-btn" title="Click points to draw polygon area" style="background:rgba(255,255,255,0.15);${btnStyle}">⬡ Polygon</button>
                <button id="bounds-clear-btn" title="Clear area filter" style="display:none; background:rgba(231,76,60,0.8);${btnStyle}">✕ Clear Filter</button>
            `;
            L.DomEvent.disableClickPropagation(container);
            return container;
        }
    });
    map.addControl(new boundsSelectControl());

    setTimeout(initBoundsSelectionTool, 100);

    markerGroup = L.layerGroup().addTo(map);
    map.on('zoomend', updateMarkerSizes);

    const speciesFilter = document.getElementById('speciesFilter');
    if (speciesFilter) speciesFilter.addEventListener('input', filterObservations);

    initializeLocationSearchControls();
}

// ── MAP SYNC ──────────────────────────────────────────────────────

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
    console.log(`Map synced with ${observations.length} observations`);
}

// ── LOCATION SEARCH ───────────────────────────────────────────────

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
            goToLocation(lat, lng, query);
            return;
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

// ── COORDINATE PARSING ────────────────────────────────────────────

function parseCoordinates(text) {
    if (!text) return null;

    const decodedText = text
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
        .replace(/&#176;/g, '°');

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
            } else if (match.length >= 4 && isNaN(match[2])) {
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

// ── DATA LOADING ──────────────────────────────────────────────────

function extractObservations(htmlContent, sourceUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const foundObservations = [];

    const imageLinks = doc.querySelectorAll('a[data-title]');

    imageLinks.forEach((link, index) => {
        const dataTitle = link.getAttribute('data-title');
        const img = link.querySelector('img');

        if (dataTitle && img) {
            const decodedTitle = dataTitle
                .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&').replace(/&quot;/g, '"');

            let speciesMatch = decodedTitle.match(/<p4><i>(.*?)<\/i>\s*[-–]\s*([^<]+?)<\/a><\/p4>/);
            if (!speciesMatch) speciesMatch = decodedTitle.match(/<p4><i>(.*?)<\/i>\s*[-–]\s*([^<]+)<\/p4>/);
            if (!speciesMatch) speciesMatch = decodedTitle.match(/<i>(.*?)<\/i>\s*[-–]\s*([^<]+?)(?:<br|$)/);

            let species = 'Unknown Species';
            let commonName = 'Unknown';
            if (speciesMatch) {
                species = speciesMatch[1].trim();
                commonName = speciesMatch[2].trim();
            }

            const coordinates = parseCoordinates(decodedTitle);
            if (coordinates) {
                let location = '';
                const locationPatterns = [
                    /<br\/?>\s*([^(]+?)(?:\s+\([0-9])/,
                    /<br\/?>\s*([^(]+?)$/,
                    /<br\/?>\s*([^<]+?)\s+\d{4}\/\d{2}\/\d{2}/
                ];
                for (let pattern of locationPatterns) {
                    const locationMatch = decodedTitle.match(pattern);
                    if (locationMatch) { location = locationMatch[1].trim(); break; }
                }

                const dateMatch = decodedTitle.match(/(\d{4}\/\d{2}\/\d{2})/);
                const photographerMatch = decodedTitle.match(/©\s*([^&]+(?:&[^&]+)*)/);

                foundObservations.push({
                    species,
                    commonName,
                    coordinates,
                    location,
                    date: dateMatch ? dateMatch[1] : '',
                    photographer: photographerMatch ? photographerMatch[1].trim() : '',
                    imageUrl: img.getAttribute('src'),
                    fullImageUrl: link.getAttribute('href'),
                    sourceUrl,
                    originalTitle: decodedTitle
                });
            }
        }
    });

    return foundObservations;
}

async function loadObservations() {
    if (isLoading) return;
    isLoading = true;

    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) { loadingDiv.style.display = 'block'; loadingDiv.textContent = 'Loading...'; }

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
                        let content;
                        if (proxy.type === 'json') {
                            const data = await response.json();
                            content = data.contents || data.body;
                        } else {
                            content = await response.text();
                        }
                        if (content && content.length > 1000) return content;
                    }
                } catch (e) {
                    if (retry < 1) await new Promise(r => setTimeout(r, 1000));
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
            const htmlContent = await fetchWithFallbacks(url);
            const siteObservations = extractObservations(htmlContent, url);
            observations.push(...siteObservations);
            totalLoaded += siteObservations.length;
        } catch (error) {
            errors.push(`${getPageName(url)}: ${error.message}`);
        }
        if (i < sourceUrls.length - 1) await new Promise(r => setTimeout(r, 1000));
    }

    if (loadingDiv) loadingDiv.style.display = 'none';

    displayObservations();
    isLoading = false;

    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('obs') && typeof infiniteGalleryUpdater !== 'undefined' &&
        infiniteGalleryUpdater.filteredImages && infiniteGalleryUpdater.currentSearchParams &&
        !isViewingSingleObservation) {
        syncMapWithSearchResults(infiniteGalleryUpdater.filteredImages);
    }
}

// ── DISPLAY ───────────────────────────────────────────────────────

function displayObservations() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('obs') || isViewingSingleObservation) return;

    markerGroup.clearLayers();
    const filteredObs = getCurrentFilteredObservations();
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    filteredObs.forEach(obs => {
        const marker = L.circleMarker(obs.coordinates, {
            radius: getMarkerRadius(),
            fillColor: '#ff6b35',
            color: '#ffffff',
            weight: isTouchDevice ? 3 : 2,
            opacity: 1,
            fillOpacity: 0.95,
            interactive: true,
            bubblingMouseEvents: false,
            pane: 'markerPane'
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
        `, {
            maxWidth: isTouchDevice ? 280 : 300,
            closeButton: true, autoPan: true, keepInView: true,
            className: 'custom-popup', autoPanPadding: [10, 10]
        });

        marker.on('click', function() { if (!this.isPopupOpen()) this.openPopup(); });
        if (isTouchDevice) {
            marker.on('touchstart', function() {
                const self = this;
                setTimeout(() => { if (!self.isPopupOpen()) self.openPopup(); }, 100);
            });
        }

        marker._butterflyMarker = true;
        marker.addTo(markerGroup);
    });

    if (filteredObs.length > 0) {
        const group = new L.featureGroup(markerGroup.getLayers());
        map.fitBounds(group.getBounds().pad(0.1));
    }

    updateStats();
}

function getMarkerRadius() {
    if (!map) return 8;
    const zoom = map.getZoom();
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
        if (zoom <= 4) return 10; if (zoom <= 6) return 11; if (zoom <= 8) return 12;
        if (zoom <= 10) return 14; if (zoom <= 12) return 16; if (zoom <= 14) return 18;
        if (zoom <= 16) return 20; return 22;
    } else {
        if (zoom <= 4) return 6; if (zoom <= 6) return 7; if (zoom <= 8) return 8;
        if (zoom <= 10) return 9; if (zoom <= 12) return 10; if (zoom <= 14) return 11;
        return 12;
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
    const speciesFilter = (document.getElementById('speciesFilter')?.value || '').toLowerCase();
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
    const uniqueSpecies = new Set(filteredObs.map(obs => obs.species)).size;
    const uniqueLocations = new Set(filteredObs.map(obs => obs.location)).size;
    const sourceCounts = {};
    observations.forEach(obs => {
        const pageName = getPageName(obs.sourceUrl);
        sourceCounts[pageName] = (sourceCounts[pageName] || 0) + 1;
    });

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
        'butterflies-of-texas.html': 'Texas',
        'butterflies-of-puerto-rico.html': 'Puerto Rico',
        'butterflies-of-new-mexico.html': 'New Mexico',
        'butterflies-of-arizona.html': 'Arizona',
        'butterflies-of-panama.html': 'Panama',
        'butterflies-of-florida.html': 'Florida',
        'new-butterflies.html': 'New Butterflies',
        'dual-checklist.html': 'Dual Checklist'
    };
    for (const [key, name] of Object.entries(pageNames)) {
        if (url.includes(key)) return name;
    }
    return 'Unknown';
}

// ── AUTO-INIT ─────────────────────────────────────────────────────

function autoClickLoadButton() {
    const buttons = document.querySelectorAll('button');
    for (let button of buttons) {
        if ((button.onclick && button.onclick.toString().includes('loadObservations')) ||
            (button.getAttribute('onclick') && button.getAttribute('onclick').includes('loadObservations')) ||
            button.textContent.includes('Load') || button.textContent.includes('Refresh')) {
            button.click();
            return true;
        }
    }
    return false;
}

function initializeMapSimple() {
    if (typeof map === 'undefined') {
        const mapDiv = document.getElementById('map');
        if (mapDiv && typeof L !== 'undefined') {
            initMap();
        } else {
            return false;
        }
    }
    if (observations.length === 0 && !isLoading) return autoClickLoadButton();
    return true;
}

if (document.readyState !== 'loading') setTimeout(initializeMapSimple, 500);
document.addEventListener('DOMContentLoaded', () => setTimeout(initializeMapSimple, 500));
window.addEventListener('load', () => setTimeout(initializeMapSimple, 500));
setTimeout(initializeMapSimple, 2000);
setTimeout(initializeMapSimple, 4000);
setTimeout(initializeMapSimple, 7000);

function refreshMap() { loadObservations(); }
