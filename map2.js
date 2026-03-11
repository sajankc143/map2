let map;
let observations = [];
let markers = [];
let markerGroup;
let isLoading = false;
let geocoder = null;
let isViewingSingleObservation = false; // Add this flag

const sourceUrls = [
    "https://www.butterflyexplorers.com/p/new-butterflies.html",
    
];
function showObservationOnMap(observationData) {
    if (!map || !observationData) return;
    
    // Set flag to prevent auto-sync from overriding this view
    isViewingSingleObservation = true;
    
    console.log('Showing single observation on map');
    
    // Parse coordinates from the observation data
    const coords = parseCoordinates(observationData.originalTitle || observationData.fullTitle);
    
    if (!coords) {
        console.log('No coordinates found for this observation');
        isViewingSingleObservation = false;
        return;
    }
    
    // Clear existing markers but DON'T clear observations array
    clearMap();
    
    // Create marker for this specific observation
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
    
    // Create popup content
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
    
    // Add marker to map
    marker.addTo(markerGroup);
    
    // Center map on this observation
    map.setView(coords, 12);
    
    // Auto-open the popup
    marker.openPopup();
    
    console.log(`Map centered on observation: ${observationData.species} at`, coords);
}
// Enhanced initMap function with simplified location search
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

    // Define different tile layers
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

    // Add default layer (Normal)
    baseLayers["Normal"].addTo(map);

    // Add layer control
    const layerControl = L.control.layers(baseLayers, null, {
        position: 'topright',
        collapsed: false
    }).addTo(map);

    // Create custom toggle button
    const mapToggleControl = L.Control.extend({
        options: {
            position: 'topleft'
        },

        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            
            container.style.cssText = `
                background: rgba(255, 255, 255, 0.9);
                width: 120px;
                height: 40px;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 12px;
                color: #333;
                backdrop-filter: blur(10px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                transition: all 0.3s ease;
            `;
            
            container.innerHTML = '🗺️ Normal';
            
            let currentLayer = 'Normal';
            
            container.onclick = function() {
                // Cycle through map types
                const layerKeys = Object.keys(baseLayers);
                const currentIndex = layerKeys.indexOf(currentLayer);
                const nextIndex = (currentIndex + 1) % layerKeys.length;
                const nextLayer = layerKeys[nextIndex];
                
                // Remove current layer and add new one
                map.removeLayer(baseLayers[currentLayer]);
                map.addLayer(baseLayers[nextLayer]);
                
                // Update button
                currentLayer = nextLayer;
                const icons = {
                    'Normal': '🗺️',
                    'Satellite': '🛰️',
                    'Terrain': '🏔️',
                    'Dark': '🌙'
                };
                container.innerHTML = `${icons[nextLayer]} ${nextLayer}`;
                
                // Update button style based on layer
                if (nextLayer === 'Dark') {
                    container.style.background = 'rgba(50, 50, 50, 0.9)';
                    container.style.color = '#fff';
                } else {
                    container.style.background = 'rgba(255, 255, 255, 0.9)';
                    container.style.color = '#333';
                }
            };
            
            // Prevent map interaction when clicking the control
            L.DomEvent.disableClickPropagation(container);
            
            return container;
        }
    });

    // Add the custom toggle control
    map.addControl(new mapToggleControl());

    markerGroup = L.layerGroup().addTo(map);
    
    // Add zoom event listener for responsive marker sizing
    map.on('zoomend', updateMarkerSizes);

    const speciesFilter = document.getElementById('speciesFilter');
    if (speciesFilter) {
        speciesFilter.addEventListener('input', filterObservations);
    }

    // Initialize the simplified location search controls
    initializeLocationSearchControls();
}
// UPDATE this function in your map script
function resetMapToAllObservations() {
    if (!map) return;
    
    console.log('Resetting map to show all observations');
    
    // IMPORTANT: Clear the single observation flag
    isViewingSingleObservation = false;
    
    // If we have filtered images from the gallery, use those
    if (typeof infiniteGalleryUpdater !== 'undefined' && 
        infiniteGalleryUpdater.filteredImages && 
        infiniteGalleryUpdater.filteredImages.length > 0) {
        
        console.log(`Restoring map view with ${infiniteGalleryUpdater.filteredImages.length} filtered observations`);
        syncMapWithSearchResults(infiniteGalleryUpdater.filteredImages);
    } 
    // Otherwise fall back to all loaded observations
    else if (observations && observations.length > 0) {
        console.log(`Restoring map view with ${observations.length} total observations`);
        displayObservations();
    }
    // If no observations available, just clear the map
    else {
        console.log('No observations to display, clearing map');
        clearMap();
    }
}

// UPDATE this function in your map script
function syncMapWithSearchResults(searchFilteredImages) {
    // FIXED: Always clear the flag when syncing with search results
    isViewingSingleObservation = false;
    
    // Clear existing observations
    observations = [];
    
    // Convert search results to map observation format
    searchFilteredImages.forEach(image => {
        // Try to extract coordinates from the image data
        const coords = parseCoordinates(image.originalTitle || image.fullTitle);
        
        if (coords) {
            observations.push({
                species: image.species,
                commonName: image.commonName,
                coordinates: coords,
                location: image.location || '',
                date: image.date || '',
                photographer: '', // Extract if available
                imageUrl: image.thumbnailUrl,
                fullImageUrl: image.fullImageUrl,
                sourceUrl: image.sourceUrl,
                originalTitle: image.originalTitle || image.fullTitle
            });
        }
    });
    
    // Update the map display
    displayObservations();
    console.log(`Map synced with ${observations.length} observations from search results`);
}

// Simplified function to initialize location search controls
function initializeLocationSearchControls() {
    const topControlsContainer = document.querySelector('.top-controls');
    
    if (topControlsContainer) {
        const locationSearchHTML = `
            <div class="control-group">
                <label>Go to Location</label>
                <div style="display: flex; gap: 5px;">
                    <input type="text" id="locationInput" placeholder="Enter city, state, or coordinates..." style="flex: 1;" />
                    <button onclick="searchByLocation()" style="padding: 8px 12px;">Go</button>
                </div>
                <div id="locationResults" style="font-size: 12px; color: #666; min-height: 20px; margin-top: 5px;"></div>
            </div>
        `;
        
        topControlsContainer.insertAdjacentHTML('beforeend', locationSearchHTML);
        
        // Add enter key handler for location input
        const locationInput = document.getElementById('locationInput');
        if (locationInput) {
            locationInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchByLocation();
                }
            });
        }
    }
}

// Simplified location search - just moves map to location
async function searchByLocation() {
    const input = document.getElementById('locationInput');
    const query = input.value.trim();
    
    if (!query) {
        alert('Please enter a location');
        return;
    }
    
    // Check if input looks like coordinates
    const coordMatch = query.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            goToLocation(lat, lng, query);
            return;
        }
    }
    
    // Geocode the location using Nominatim (free OpenStreetMap geocoding)
    try {
        showLocationResults('Searching for location...');
        
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            const displayName = data[0].display_name;
            
            goToLocation(lat, lng, displayName);
        } else {
            showLocationResults('Location not found. Try a different search term or use coordinates (lat, lng).');
        }
    } catch (error) {
        console.error('Geocoding error:', error);
        showLocationResults('Error searching for location. Try using coordinates (lat, lng) format.');
    }
}

// Simple function to move map to location
function goToLocation(lat, lng, locationName = null) {
    // Move map to location
    map.setView([lat, lng], 10);
    
    // Show simple confirmation message
    const locationDisplay = locationName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    showLocationResults(`Moved to: ${locationDisplay}`);
    
    // Clear the message after a few seconds
    setTimeout(() => {
        showLocationResults('');
    }, 3000);
}

function showLocationResults(html) {
    const resultsDiv = document.getElementById('locationResults');
    if (resultsDiv) {
        resultsDiv.innerHTML = html;
    }
}

// Original functions (unchanged)
function parseCoordinates(text) {
    if (!text) return null;

    console.log('Parsing coordinates from:', text.substring(0, 100) + '...');

    const decodedText = text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
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
            console.log('Coordinate match found:', match);
            
            if (match.length >= 8) {
                const latDeg = parseInt(match[1]);
                const latMin = parseInt(match[2]);
                const latSec = parseFloat(match[3]);
                const latDir = match[4];
                
                const lonDeg = parseInt(match[5]);
                const lonMin = parseInt(match[6]);
                const lonSec = parseFloat(match[7]);
                const lonDir = match[8];

                let lat = latDeg + latMin/60 + latSec/3600;
                let lon = lonDeg + lonMin/60 + lonSec/3600;

                if (latDir === 'S') lat = -lat;
                if (lonDir === 'W') lon = -lon;

                console.log('Parsed DMS coordinates:', [lat, lon]);
                return [lat, lon];
            } else if (match.length >= 4) {
                let lat = parseFloat(match[1]);
                const latDir = match[2];
                let lon = parseFloat(match[3]);
                const lonDir = match[4];

                if (latDir === 'S') lat = -lat;
                if (lonDir === 'W') lon = -lon;

                console.log('Parsed decimal coordinates with directions:', [lat, lon]);
                return [lat, lon];
            } else if (match.length >= 3) {
                const lat = parseFloat(match[1]);
                const lon = parseFloat(match[2]);
                
                if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                    console.log('Parsed plain decimal coordinates:', [lat, lon]);
                    return [lat, lon];
                }
            }
        }
    }

    console.log('No coordinates found in:', decodedText.substring(0, 200));
    return null;
}

function extractObservations(htmlContent, sourceUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const foundObservations = [];

    const imageLinks = doc.querySelectorAll('a[data-title]');
    console.log(`Found ${imageLinks.length} image links with data-title in ${getPageName(sourceUrl)}`);

    imageLinks.forEach((link, index) => {
        const dataTitle = link.getAttribute('data-title');
        const img = link.querySelector('img');
        
        if (dataTitle && img) {
            console.log(`Processing image ${index + 1}:`, dataTitle.substring(0, 100) + '...');
            
            const decodedTitle = dataTitle.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
            
            let speciesMatch = decodedTitle.match(/<p4><i>(.*?)<\/i>\s*[-–]\s*([^<]+?)<\/a><\/p4>/);
            if (!speciesMatch) {
                speciesMatch = decodedTitle.match(/<p4><i>(.*?)<\/i>\s*[-–]\s*([^<]+)<\/p4>/);
            }
            if (!speciesMatch) {
                speciesMatch = decodedTitle.match(/<i>(.*?)<\/i>\s*[-–]\s*([^<]+?)(?:<br|$)/);
            }
            
            let species = 'Unknown Species';
            let commonName = 'Unknown';

            if (speciesMatch) {
                species = speciesMatch[1].trim();
                commonName = speciesMatch[2].trim();
                console.log(`Parsed species: ${species} - ${commonName}`);
            } else {
                console.log('Could not parse species from title');
            }

            const coordinates = parseCoordinates(decodedTitle);
            
            if (coordinates) {
                console.log(`Found coordinates: ${coordinates}`);
                
                let location = '';
                const locationPatterns = [
                    /<br\/?>\s*([^(]+?)(?:\s+\([0-9])/,
                    /<br\/?>\s*([^(]+?)$/,
                    /<br\/?>\s*([^<]+?)\s+\d{4}\/\d{2}\/\d{2}/
                ];
                
                for (let pattern of locationPatterns) {
                    const locationMatch = decodedTitle.match(pattern);
                    if (locationMatch) {
                        location = locationMatch[1].trim();
                        break;
                    }
                }

                const dateMatch = decodedTitle.match(/(\d{4}\/\d{2}\/\d{2})/);
                let date = '';
                if (dateMatch) {
                    date = dateMatch[1];
                }

                const photographerMatch = decodedTitle.match(/©\s*([^&]+(?:&[^&]+)*)/);
                let photographer = '';
                if (photographerMatch) {
                    photographer = photographerMatch[1].trim();
                }

                foundObservations.push({
                    species: species,
                    commonName: commonName,
                    coordinates: coordinates,
                    location: location,
                    date: date,
                    photographer: photographer,
                    imageUrl: img.getAttribute('src'),
                    fullImageUrl: link.getAttribute('href'),
                    sourceUrl: sourceUrl,
                    originalTitle: decodedTitle
                });
                
                console.log(`Added observation: ${species} at ${location}`);
            } else {
                console.log(`No coordinates found for: ${species} - ${commonName}`);
            }
        }
    });

    console.log(`Extracted ${foundObservations.length} observations with coordinates from ${getPageName(sourceUrl)}`);
    return foundObservations;
}

async function loadObservations() {
    if (isLoading) {
        console.log('Already loading, skipping duplicate request');
        return;
    }
    
    isLoading = true;
    console.log('=== ROBUST LOAD OBSERVATIONS STARTED ===');
    
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'block';
        loadingDiv.textContent = 'Starting to load butterfly observations...';
    }
    
    observations = [];
    clearMap();

    const proxyServices = [
        {
            url: 'https://corsproxy.io/?',
            type: 'text'
        },
        {
            url: 'https://api.allorigins.win/get?url=',
            type: 'json'
        },
        {
            url: 'https://api.codetabs.com/v1/proxy?quest=',
            type: 'text'
        },
        {
            url: 'https://thingproxy.freeboard.io/fetch/',
            type: 'text'
        }
    ];

    let totalLoaded = 0;
    const errors = [];
    const maxRetries = 2;

    async function fetchWithFallbacks(url) {
        for (let proxyIndex = 0; proxyIndex < proxyServices.length; proxyIndex++) {
            const proxy = proxyServices[proxyIndex];
            
            for (let retry = 0; retry < maxRetries; retry++) {
                try {
                    const proxyUrl = proxy.url + encodeURIComponent(url);
                    console.log(`Trying proxy ${proxyIndex + 1}, attempt ${retry + 1}:`, proxy.url);
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 20000);
                    
                    const response = await fetch(proxyUrl, {
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; ButterflyBot/1.0)',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                        }
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        let content;
                        
                        if (proxy.type === 'json') {
                            const data = await response.json();
                            content = data.contents || data.body;
                        } else {
                            content = await response.text();
                        }
                        
                        if (content && content.length > 1000) {
                            console.log(`✅ Success with proxy ${proxyIndex + 1} on attempt ${retry + 1}`);
                            return content;
                        } else {
                            throw new Error('Content too short or empty');
                        }
                    } else {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                } catch (error) {
                    console.log(`❌ Proxy ${proxyIndex + 1}, attempt ${retry + 1} failed:`, error.message);
                    
                    if (retry < maxRetries - 1) {
                        const delay = 1000 + (retry * 1000);
                        console.log(`Waiting ${delay}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
        }
        
        throw new Error('All proxies and retries failed');
    }

    for (let i = 0; i < sourceUrls.length; i++) {
        const url = sourceUrls[i];
        const pageName = getPageName(url);
        
        console.log(`\n--- Processing ${i + 1}/${sourceUrls.length}: ${pageName} ---`);
        
        if (loadingDiv) {
            loadingDiv.textContent = `Loading ${pageName}... (${i + 1}/${sourceUrls.length})`;
        }
        
        try {
            const htmlContent = await fetchWithFallbacks(url);
            const siteObservations = extractObservations(htmlContent, url);
            
            observations.push(...siteObservations);
            totalLoaded += siteObservations.length;
            
            console.log(`✅ ${pageName}: ${siteObservations.length} observations (Total: ${totalLoaded})`);
            
            if (loadingDiv) {
                loadingDiv.textContent = `Loaded ${pageName} - ${totalLoaded} observations found so far...`;
            }
            
        } catch (error) {
            console.error(`❌ Failed to load ${pageName}:`, error.message);
            errors.push(`${pageName}: ${error.message}`);
            
            if (loadingDiv) {
                loadingDiv.textContent = `Failed to load ${pageName}, continuing with others...`;
            }
        }

        if (i < sourceUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }

    console.log(`\n=== LOADING COMPLETE ===`);
    console.log(`Successfully loaded: ${totalLoaded} observations`);
    console.log(`Failed pages: ${errors.length}`);

    if (errors.length > 0) {
        console.log('Errors:', errors);
        
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            background: #fff3cd; 
            border: 1px solid #ffeaa7; 
            color: #856404; 
            padding: 10px; 
            margin: 10px 0; 
            border-radius: 4px;
            position: relative;
        `;
        errorDiv.innerHTML = `
            <strong>Some pages couldn't be loaded:</strong><br>
            ${errors.join('<br>')}
            <br><small>Showing ${totalLoaded} observations from ${sourceUrls.length - errors.length} successful pages.</small>
            <button onclick="this.parentElement.remove()" style="position: absolute; top: 5px; right: 10px; background: none; border: none; font-size: 16px; cursor: pointer;">×</button>
        `;
        
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(errorDiv, document.getElementById('map'));
        }
        
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 15000);
    }

    displayObservations();
    isLoading = false;
    
    if (totalLoaded > 0) {
        console.log(`✅ Successfully loaded butterfly map with ${totalLoaded} observations!`);
    } else {
        console.log('⚠️ No observations loaded - all sources may be down');
        
        if (loadingDiv) {
            loadingDiv.style.display = 'block';
            loadingDiv.innerHTML = `
                <div style="color: #856404;">
                    No observations could be loaded from any source. 
                    <button onclick="loadObservations()" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    // SIMPLE FIX: Check URL before auto-syncing
    const urlParams = new URLSearchParams(window.location.search);
    const obsId = urlParams.get('obs');
    
    if (!obsId) {
        // Only do normal sync if there's no observation ID in URL
        if (typeof infiniteGalleryUpdater !== 'undefined' && 
            infiniteGalleryUpdater.filteredImages && 
            infiniteGalleryUpdater.currentSearchParams &&
            !isViewingSingleObservation) {
            
            console.log('Initial sync with existing search filters');
            syncMapWithSearchResults(infiniteGalleryUpdater.filteredImages);
        }
    } else {
        console.log(`URL contains observation ID ${obsId}, skipping initial sync - waiting for gallery to show single observation`);
    }
}

// Mobile-friendly displayObservations function:
function displayObservations() {
    // Check if URL has observation ID - if so, don't show all observations
    const urlParams = new URLSearchParams(window.location.search);
    const obsId = urlParams.get('obs');
    
    if (obsId) {
        console.log('URL contains observation ID, skipping displayObservations');
        return;
    }
    
    // Don't display all observations if we're viewing a single one
    if (isViewingSingleObservation) {
        console.log('Skipping displayObservations - viewing single observation');
        return;
    }
    
    markerGroup.clearLayers();

    const filteredObs = getCurrentFilteredObservations();
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    filteredObs.forEach(obs => {
        const markerRadius = getMarkerRadius();
        const marker = L.circleMarker(obs.coordinates, {
            radius: markerRadius,
            fillColor: '#ff6b35',     
            color: '#ffffff',         
            weight: isTouchDevice ? 3 : 2,  
            opacity: 1,
            fillOpacity: 0.95,        
            interactive: true,        
            bubblingMouseEvents: false, 
            pane: 'markerPane'       
        });

        const popupContent = `
            <div>
                <div class="popup-species">${obs.species}</div>
                <div class="popup-common">${obs.commonName}</div>
                ${obs.imageUrl ? `<img src="${obs.imageUrl}" class="popup-image" alt="${obs.species}" onerror="this.style.display='none'">` : ''}
                <div class="popup-location">📍 ${obs.location}</div>
                ${obs.date ? `<div class="popup-date">📅 ${obs.date}</div>` : ''}
                ${obs.photographer ? `<div class="popup-date">📷 ${obs.photographer}</div>` : ''}
            </div>
        `;

        marker.bindPopup(popupContent, {
            maxWidth: isTouchDevice ? 280 : 300,
            closeButton: true,
            autoPan: true,
            keepInView: true,
            className: 'custom-popup',
            autoPanPadding: [10, 10],
            closeOnClick: true,          
            closeOnEscapeKey: true       
        });
        
        marker.on('click', function(e) {
            if (!this.isPopupOpen()) {
                this.openPopup();
            }
        });

        if (isTouchDevice) {
            marker.on('touchstart', function(e) {
                const self = this;
                setTimeout(() => {
                    if (!self.isPopupOpen()) {
                        self.openPopup();
                    }
                }, 100);
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

// Add this new function to calculate marker size based on zoom level
function getMarkerRadius() {
    if (!map) return 8; // Increased default size from 6 to 8
    
    const zoom = map.getZoom();
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    if (isTouchDevice) {
        // Enhanced mobile scaling - much larger at high zoom levels
        if (zoom <= 4) return 10;       // Was 8, now 10
        else if (zoom <= 6) return 11;  // Was 9, now 11
        else if (zoom <= 8) return 12;  // Was 10, now 12
        else if (zoom <= 10) return 14; // Was 12, now 14
        else if (zoom <= 12) return 16; // Was 14, now 16
        else if (zoom <= 14) return 18; // Was 16, now 18
        else if (zoom <= 16) return 20; // Was 18, now 20
        else return 22;                 // Was 20, now 22
    } else {
        // Desktop - increased sizes for easier clicking
        if (zoom <= 4) return 6;        // Was 4, now 6
        else if (zoom <= 6) return 7;   // Was 5, now 7
        else if (zoom <= 8) return 8;   // Was 6, now 8
        else if (zoom <= 10) return 9;  // Was 7, now 9
        else if (zoom <= 12) return 10; // Was 8, now 10
        else if (zoom <= 14) return 11; // Was 9, now 11
        else return 12;                 // Was 10, now 12
    }
}

// Add this function to update marker sizes when zoom changes (smooth)
function updateMarkerSizes() {
    const newRadius = getMarkerRadius();
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    markerGroup.eachLayer(function(marker) {
        if (marker._butterflyMarker && marker.setRadius) {
            marker.setStyle({
                radius: newRadius,
                weight: isTouchDevice ? 3 : 2  // Adjust border thickness too
            });
        }
    });
}

function filterObservations() {
    displayObservations();
}

function getCurrentFilteredObservations() {
    const speciesFilterElement = document.getElementById('speciesFilter');
    const speciesFilter = speciesFilterElement ? speciesFilterElement.value.toLowerCase() : '';
    
    if (!speciesFilter) {
        return observations;
    }

    return observations.filter(obs => 
        obs.species.toLowerCase().includes(speciesFilter) ||
        obs.commonName.toLowerCase().includes(speciesFilter)
    );
}

function clearMap() {
    if (markerGroup) {
        markerGroup.clearLayers();
    }
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

    const statsHtml = `
        <div class="stat-card">
            <div class="stat-number">${filteredObs.length}</div>
            <div class="stat-label">Total Observations</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${uniqueSpecies}</div>
            <div class="stat-label">Unique Species</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${uniqueLocations}</div>
            <div class="stat-label">Unique Locations</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${Object.keys(sourceCounts).length}</div>
            <div class="stat-label">Source Pages</div>
        </div>
    `;

    const statsElement = document.getElementById('stats');
    if (statsElement) {
        statsElement.innerHTML = statsHtml;
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

function autoClickLoadButton() {
    console.log('=== ATTEMPTING AUTO-CLICK OF LOAD BUTTON ===');
    
    const buttons = document.querySelectorAll('button');
    let loadButton = null;
    
    for (let button of buttons) {
        if (button.onclick && button.onclick.toString().includes('loadObservations')) {
            loadButton = button;
            break;
        }
        if (button.getAttribute('onclick') && button.getAttribute('onclick').includes('loadObservations')) {
            loadButton = button;
            break;
        }
        if (button.textContent.includes('Load') || button.textContent.includes('Refresh')) {
            loadButton = button;
            break;
        }
    }
    
    if (loadButton) {
        console.log('Found load button, clicking it...');
        loadButton.click();
        return true;
    } else {
        console.log('Load button not found');
        return false;
    }
}

function initializeMapSimple() {
    console.log('=== SIMPLE GITHUB PAGES INITIALIZATION ===');
    
    if (typeof map === 'undefined') {
        const mapDiv = document.getElementById('map');
        if (mapDiv && typeof L !== 'undefined') {
            console.log('Initializing map...');
            initMap();
        } else {
            console.log('Map div or Leaflet not ready, retrying...');
            return false;
        }
    }
    
    if (observations.length === 0 && !isLoading) {
        return autoClickLoadButton();
    }
    
    return true;
}

console.log('Setting up auto-load for GitHub Pages...');

if (document.readyState !== 'loading') {
    setTimeout(initializeMapSimple, 500);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, attempting auto-load...');
    setTimeout(initializeMapSimple, 500);
});

window.addEventListener('load', () => {
    console.log('Window loaded, attempting auto-load...');
    setTimeout(initializeMapSimple, 500);
});

setTimeout(() => {
    console.log('Backup attempt 1 (2s)');
    initializeMapSimple();
}, 2000);

setTimeout(() => {
    console.log('Backup attempt 2 (4s)');
    initializeMapSimple();
}, 4000);

setTimeout(() => {
    console.log('Final attempt (7s)');
    initializeMapSimple();
}, 7000);

function refreshMap() {
    console.log('Manual refresh triggered');
    loadObservations();
}

function debugGitHub() {
    console.log('=== GITHUB DEBUG ===');
    console.log('Document ready:', document.readyState);
    console.log('Leaflet available:', typeof L !== 'undefined');
    console.log('Map exists:', !!document.getElementById('map'));
    console.log('Map initialized:', typeof map !== 'undefined');
    console.log('Observations:', observations.length);
    console.log('Load button found:', !!document.querySelector('button[onclick*="loadObservations"]'));
}

setTimeout(debugGitHub, 3000);
