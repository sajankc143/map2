let map;
let observations = [];
let markers = [];
let markerGroup;
let isLoading = false;
let searchCircle = null;
let geocoder = null;

const sourceUrls = [
    "https://www.butterflyexplorers.com/p/new-butterflies.html",
    "https://www.butterflyexplorers.com/p/dual-checklist.html",
    "https://www.butterflyexplorers.com/p/butterflies-of-arizona.html",
    "https://www.butterflyexplorers.com/p/butterflies-of-florida.html",
    "https://www.butterflyexplorers.com/p/butterflies-of-texas.html",
    "https://www.butterflyexplorers.com/p/butterflies-of-puerto-rico.html",
    "https://www.butterflyexplorers.com/p/butterflies-of-new-mexico.html",
    "https://www.butterflyexplorers.com/p/butterflies-of-panama.html"
];

// Enhanced initMap function with location search capabilities
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

    // Create location search control
    const locationSearchControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control location-search-control');
            
            container.style.cssText = `
                background: rgba(255, 255, 255, 0.95);
                padding: 10px;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                backdrop-filter: blur(10px);
                min-width: 280px;
            `;
            
            container.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: bold; color: #333;">🦋 Search by Location</div>
                <div style="display: flex; gap: 5px; margin-bottom: 8px;">
                    <input type="text" id="locationInput" placeholder="Enter city, state, or coordinates..." 
                           style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                    <button onclick="searchByLocation()" 
                            style="padding: 6px 10px; background: #28a745; color: black; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        Search
                    </button>
                </div>
                <div style="display: flex; gap: 5px; align-items: center; margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #666;">Radius:</label>
                    <input type="range" id="radiusSlider" min="5" max="200" value="50" 
                           style="flex: 1;" onchange="updateRadiusDisplay()">
                    <span id="radiusDisplay" style="font-size: 11px; color: #666; min-width: 35px;">50 km</span>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button onclick="clearLocationSearch()" 
                            style="flex: 1; padding: 4px; background: #dc3545; color: black; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                        Clear
                    </button>
                    <button onclick="toggleLocationMode()" id="locationModeBtn"
                            style="flex: 1; padding: 4px; background: #007bff; color: black; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                        Click Mode
                    </button>
                </div>
                <div id="locationResults" style="margin-top: 8px; font-size: 11px; color: #666; max-height: 100px; overflow-y: auto;"></div>
            `;
            
            // Prevent map interaction when interacting with the control
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);
            
            // Add enter key handler for location input
            const locationInput = container.querySelector('#locationInput');
            locationInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchByLocation();
                }
            });
            
            return container;
        }
    });

    // Add the location search control
    map.addControl(new locationSearchControl());

    markerGroup = L.layerGroup().addTo(map);
    
    // Add zoom event listener for responsive marker sizing
    map.on('zoomend', updateMarkerSizes);

    // Initialize click mode as false
    window.locationClickMode = false;

    // Add click handler for location-based search
    map.on('click', function(e) {
        if (window.locationClickMode) {
            searchAroundPoint(e.latlng.lat, e.latlng.lng);
        }
    });

    const speciesFilter = document.getElementById('speciesFilter');
    if (speciesFilter) {
        speciesFilter.addEventListener('input', filterObservations);
    }
}

// New location search functions
function updateRadiusDisplay() {
    const slider = document.getElementById('radiusSlider');
    const display = document.getElementById('radiusDisplay');
    if (slider && display) {
        display.textContent = slider.value + ' km';
        
        // Update existing search circle if it exists
        if (searchCircle) {
            const center = searchCircle.getLatLng();
            map.removeLayer(searchCircle);
            
            searchCircle = L.circle(center, {
                radius: slider.value * 1000, // Convert km to meters
                color: '#007bff',
                fillColor: '#007bff',
                fillOpacity: 0.1,
                weight: 2
            }).addTo(map);
        }
    }
}

function toggleLocationMode() {
    window.locationClickMode = !window.locationClickMode;
    const btn = document.getElementById('locationModeBtn');
    
    if (window.locationClickMode) {
        btn.textContent = 'Click Active';
        btn.style.background = '#28a745';
        map.getContainer().style.cursor = 'crosshair';
        showLocationMessage('Click on the map to search for species around that location!');
    } else {
        btn.textContent = 'Click Mode';
        btn.style.background = '#007bff';
        map.getContainer().style.cursor = '';
        hideLocationMessage();
    }
}

function showLocationMessage(message) {
    let msgDiv = document.getElementById('locationMessage');
    if (!msgDiv) {
        msgDiv = document.createElement('div');
        msgDiv.id = 'locationMessage';
        msgDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 123, 255, 0.9);
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 2000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            pointer-events: none;
        `;
        document.body.appendChild(msgDiv);
    }
    msgDiv.textContent = message;
    msgDiv.style.display = 'block';
}

function hideLocationMessage() {
    const msgDiv = document.getElementById('locationMessage');
    if (msgDiv) {
        msgDiv.style.display = 'none';
    }
}

async function searchByLocation() {
    const input = document.getElementById('locationInput');
    const query = input.value.trim();
    
    if (!query) {
        alert('Please enter a location to search');
        return;
    }
    
    // Check if input looks like coordinates
    const coordMatch = query.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            searchAroundPoint(lat, lng, query);
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
            
            searchAroundPoint(lat, lng, displayName);
        } else {
            showLocationResults('Location not found. Try a different search term or use coordinates (lat, lng).');
        }
    } catch (error) {
        console.error('Geocoding error:', error);
        showLocationResults('Error searching for location. Try using coordinates (lat, lng) format.');
    }
}

function searchAroundPoint(lat, lng, locationName = null) {
    const radiusKm = parseInt(document.getElementById('radiusSlider').value);
    const radiusMeters = radiusKm * 1000;
    
    // Clear previous search circle
    if (searchCircle) {
        map.removeLayer(searchCircle);
    }
    
    // Add search circle
    searchCircle = L.circle([lat, lng], {
        radius: radiusMeters,
        color: '#007bff',
        fillColor: '#007bff',
        fillOpacity: 0.1,
        weight: 2
    }).addTo(map);
    
    // Find observations within the radius
    const nearbyObservations = observations.filter(obs => {
        const distance = calculateDistance(lat, lng, obs.coordinates[0], obs.coordinates[1]);
        return distance <= radiusKm;
    });
    
    // Get unique species
    const uniqueSpecies = [...new Set(nearbyObservations.map(obs => obs.species))];
    const speciesCount = {};
    
    nearbyObservations.forEach(obs => {
        speciesCount[obs.species] = (speciesCount[obs.species] || 0) + 1;
    });
    
    // Display results
    let resultsHtml = '';
    if (nearbyObservations.length > 0) {
        const locationDisplay = locationName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        resultsHtml = `
            <div style="font-weight: bold; color: #28a745; margin-bottom: 5px;">
                Found ${nearbyObservations.length} observations of ${uniqueSpecies.length} species
            </div>
            <div style="color: #666; font-size: 10px; margin-bottom: 5px;">
                Within ${radiusKm}km of ${locationDisplay}
            </div>
            <div style="max-height: 80px; overflow-y: auto;">
        `;
        
        // Sort species by count (most common first)
        const sortedSpecies = Object.entries(speciesCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10); // Show top 10
        
        sortedSpecies.forEach(([species, count]) => {
            resultsHtml += `<div style="font-size: 10px; margin: 1px 0;">• ${species} (${count})</div>`;
        });
        
        if (uniqueSpecies.length > 10) {
            resultsHtml += `<div style="font-size: 9px; color: #999;">...and ${uniqueSpecies.length - 10} more species</div>`;
        }
        
        resultsHtml += '</div>';
    } else {
        const locationDisplay = locationName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        resultsHtml = `
            <div style="color: #dc3545;">
                No observations found within ${radiusKm}km of ${locationDisplay}
            </div>
        `;
    }
    
    showLocationResults(resultsHtml);
    
    // Zoom to the search area
    map.fitBounds(searchCircle.getBounds(), { padding: [20, 20] });
    
    // Highlight matching observations
    highlightLocationObservations(nearbyObservations);
    
    // Turn off click mode after search
    if (window.locationClickMode) {
        toggleLocationMode();
    }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    // Haversine formula to calculate distance between two points
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function highlightLocationObservations(locationObservations) {
    // First, reset all markers to normal style
    markerGroup.eachLayer(function(marker) {
        if (marker._butterflyMarker) {
            marker.setStyle({
                fillColor: '#ff8c00',
                fillOpacity: 0.85,
                color: '#ffffff',
                weight: 2
            });
        }
    });
    
    // Then highlight the matching ones
    if (locationObservations.length > 0) {
        const locationCoords = new Set(
            locationObservations.map(obs => `${obs.coordinates[0]},${obs.coordinates[1]}`)
        );
        
        markerGroup.eachLayer(function(marker) {
            if (marker._butterflyMarker) {
                const markerCoordKey = `${marker.getLatLng().lat},${marker.getLatLng().lng}`;
                if (locationCoords.has(markerCoordKey)) {
                    marker.setStyle({
                        fillColor: '#00ff00',
                        fillOpacity: 0.9,
                        color: '#004400',
                        weight: 3,
                        radius: getMarkerRadius() + 2
                    });
                }
            }
        });
    }
}

function showLocationResults(html) {
    const resultsDiv = document.getElementById('locationResults');
    if (resultsDiv) {
        resultsDiv.innerHTML = html;
    }
}

function clearLocationSearch() {
    // Clear search circle
    if (searchCircle) {
        map.removeLayer(searchCircle);
        searchCircle = null;
    }
    
    // Clear input and results
    const input = document.getElementById('locationInput');
    const results = document.getElementById('locationResults');
    
    if (input) input.value = '';
    if (results) results.innerHTML = '';
    
    // Reset all markers to normal style
    markerGroup.eachLayer(function(marker) {
        if (marker._butterflyMarker) {
            marker.setStyle({
                fillColor: '#ff8c00',
                fillOpacity: 0.85,
                color: '#ffffff',
                weight: 2,
                radius: getMarkerRadius()
            });
        }
    });
    
    // Turn off click mode
    if (window.locationClickMode) {
        toggleLocationMode();
    }
    
    // Fit to all observations
    if (observations.length > 0) {
        const group = new L.featureGroup(markerGroup.getLayers());
        map.fitBounds(group.getBounds().pad(0.1));
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
}

// Mobile-friendly displayObservations function:
function displayObservations() {
    markerGroup.clearLayers();

    const filteredObs = getCurrentFilteredObservations();
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    filteredObs.forEach(obs => {
        const markerRadius = getMarkerRadius();
        const marker = L.circleMarker(obs.coordinates, {
            radius: markerRadius,
            fillColor: '#ff8c00',     
            color: '#ffffff',         
            weight: isTouchDevice ? 3 : 2,  
            opacity: 1,
            fillOpacity: 0.85,
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
        
        let isHovering = false;
        let hoverTimeout;
        
        if (isTouchDevice) {
            // Enhanced mobile click handling - multiple event types for reliability
            marker.on('click', function(e) {
                if (!this.isPopupOpen()) {
                    this.openPopup();
                }
            });
            
            // Add touchstart as backup for maximum zoom reliability
            marker.on('touchstart', function(e) {
                const self = this;
                setTimeout(() => {
                    if (!self.isPopupOpen()) {
                        self.openPopup();
                    }
                }, 100);
            });
            
        } else {
            // Desktop events - unchanged
            marker.on('mouseover', function(e) {
                if (!isHovering) {
                    isHovering = true;
                    this.setStyle({
                        radius: getMarkerRadius() + 2,
                        weight: 3,
                        fillColor: '#ff6b35',
                        fillOpacity: 0.95
                    });
                }
            });
            
            marker.on('mouseout', function(e) {
                isHovering = false;
                clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(() => {
                    if (!isHovering) {
                        this.setStyle({
                            radius: getMarkerRadius(),
                            weight: 2,
                            fillColor: '#ff8c00',
                            fillOpacity: 0.85
                        });
                    }
                }, 100);
            });
            
            marker.on('click', function(e) {
                if (!this.isPopupOpen()) {
                    this.openPopup();
                }
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
    if (!map) return 6; // Default size
    
    const zoom = map.getZoom();
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    if (isTouchDevice) {
        // Enhanced mobile scaling - much larger at high zoom levels
        if (zoom <= 4) return 8;        // Small at low zoom
        else if (zoom <= 6) return 9;   
        else if (zoom <= 8) return 10;  
        else if (zoom <= 10) return 12; 
        else if (zoom <= 12) return 14; 
        else if (zoom <= 14) return 16; // Large at high zoom
        else if (zoom <= 16) return 18; // Very large at max zoom
        else return 20;                 // Extra large at maximum zoom
    } else {
        // Desktop - unchanged, normal sizes
        if (zoom <= 4) return 4;        
        else if (zoom <= 6) return 5;   
        else if (zoom <= 8) return 6;   
        else if (zoom <= 10) return 7;  
        else if (zoom <= 12) return 8;  
        else if (zoom <= 14) return 9;  
        else return 10;                 // Normal max size for desktop
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
