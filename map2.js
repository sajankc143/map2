let map;
let observations = [];
let markers = [];
let markerGroup;
let isLoading = false;

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

// Here's the complete updated initMap function:
function initMap() {
    map = L.map('map', {
        preferCanvas: true,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        tap: true,                    // Enable tap events for mobile
        touchZoom: true,             // Enable touch zoom
        tapTolerance: 20,            // Increased tap tolerance for mobile (was 15)
        maxTouchPoints: 2,           // Allow 2-finger gestures
        bounceAtZoomLimits: false,   // Smoother zoom experience
        zoomSnap: 0.25,             // Finer zoom control
        zoomDelta: 0.25             // Smaller zoom steps
    }).setView([39.8283, -98.5795], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markerGroup = L.layerGroup().addTo(map);
    
    // Add zoom event listener for responsive marker sizing
    map.on('zoomend', updateMarkerSizes);

    const speciesFilter = document.getElementById('speciesFilter');
    if (speciesFilter) {
        speciesFilter.addEventListener('input', filterObservations);
    }
}
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
        // Create round markers with orange color and mobile-optimized sizes
        const markerRadius = getMarkerRadius();
        const marker = L.circleMarker(obs.coordinates, {
            radius: markerRadius,
            fillColor: '#ff8c00',     // Bright orange (DarkOrange)
            color: '#ffffff',         // White border
            weight: isTouchDevice ? 3 : 2,  // Thicker border on mobile for visibility
            opacity: 1,
            fillOpacity: 0.85,
            // Mobile-specific options
            interactive: true,        // Ensure marker is interactive
            bubblingMouseEvents: false, // Prevent event bubbling issues
            pane: 'markerPane'       // Ensure proper layering
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

        // Enhanced popup options for mobile
        marker.bindPopup(popupContent, {
            maxWidth: isTouchDevice ? 280 : 300,
            closeButton: true,
            autoPan: true,
            keepInView: true,
            className: 'custom-popup',
            autoPanPadding: [10, 10],     // Better mobile positioning
            closeOnClick: false           // Prevent accidental closing on mobile
        });
        
        // Enhanced mobile-friendly event handling
        let isHovering = false;
        let hoverTimeout;
        let touchStartTime = 0;
        
        if (isTouchDevice) {
            // Mobile/touch device events
            marker.on('touchstart', function(e) {
                touchStartTime = Date.now();
                e.originalEvent.preventDefault(); // Prevent default touch behavior
            });
            
            marker.on('touchend', function(e) {
                const touchDuration = Date.now() - touchStartTime;
                
                // Only trigger on quick taps (not long presses or drags)
                if (touchDuration < 500) {
                    e.originalEvent.preventDefault();
                    
                    // Force popup to open
                    setTimeout(() => {
                        if (!this.isPopupOpen()) {
                            this.openPopup();
                        }
                    }, 50); // Small delay to ensure proper handling
                }
            });
            
            // Also handle click as fallback
            marker.on('click', function(e) {
                e.originalEvent.preventDefault();
                if (!this.isPopupOpen()) {
                    this.openPopup();
                }
            });
            
        } else {
            // Desktop events with hover effects
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
            
            // Desktop click event
            marker.on('click', function(e) {
                if (!this.isPopupOpen()) {
                    this.openPopup();
                }
            });
        }

        // Store marker for zoom updates
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
    if (!map) return 8; // Larger default size for mobile
    
    const zoom = map.getZoom();
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    // Larger markers on mobile devices for better touch targets
    const mobileBonus = isTouchDevice ? 2 : 0;
    
    // Scale markers based on zoom level with mobile-friendly sizes
    if (zoom <= 4) return 6 + mobileBonus;        // Minimum 6px (8px on mobile)
    else if (zoom <= 6) return 7 + mobileBonus;   
    else if (zoom <= 8) return 8 + mobileBonus;   
    else if (zoom <= 10) return 9 + mobileBonus;  
    else if (zoom <= 12) return 10 + mobileBonus; 
    else if (zoom <= 14) return 11 + mobileBonus; 
    else return 12 + mobileBonus;                  // Maximum size with mobile bonus
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
