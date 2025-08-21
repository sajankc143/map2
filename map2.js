// Enhanced map initialization with better performance
function initMap() {
    map = L.map('map', {
        // Performance optimizations
        preferCanvas: true,          // Use Canvas renderer for better performance
        zoomAnimation: true,         // Enable smooth zoom
        fadeAnimation: true,         // Enable fade animations
        markerZoomAnimation: true,   // Smooth marker animations
        worldCopyJump: true,
        maxZoom: 18,
        minZoom: 3
    }).setView([39.8283, -98.5795], 4);

    // Use a faster tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
        updateWhenIdle: true,        // Only update when map stops moving
        updateWhenZooming: false,    // Don't update while zooming
        keepBuffer: 2                // Keep more tiles in memory
    }).addTo(map);

    // Use Canvas renderer for better performance with many markers
    const canvasRenderer = L.canvas({ padding: 0.5 });
    markerGroup = L.layerGroup().addTo(map);

    // Add species filter functionality
    const speciesFilter = document.getElementById('speciesFilter');
    if (speciesFilter) {
        speciesFilter.addEventListener('input', debounce(filterObservations, 300));
    }
}

// Debounce function to improve filter performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Create custom round markers like iNaturalist
function createCustomMarker(lat, lng, species, commonName, qualityGrade = 'research') {
    // Different colors based on quality/type
    const colors = {
        research: '#28a745',     // Green for research grade
        needs_id: '#ffc107',     // Yellow for needs ID
        casual: '#6c757d',       // Gray for casual
        endemic: '#dc3545',      // Red for endemic species
        rare: '#6f42c1'         // Purple for rare species
    };
    
    const color = colors[qualityGrade] || colors.research;
    
    // Create custom round marker
    const marker = L.circleMarker([lat, lng], {
        radius: 6,                    // Small round markers
        fillColor: color,
        color: '#ffffff',             // White border
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
        renderer: L.canvas()          // Use canvas renderer for performance
    });
    
    return marker;
}

// Optimized marker clustering for better performance
function createMarkerCluster() {
    // Only load clustering if we have many markers
    if (typeof L.markerClusterGroup !== 'undefined') {
        return L.markerClusterGroup({
            chunkedLoading: true,        // Load markers in chunks
            chunkProgress: function(processed, total, elapsed) {
                // Optional: show progress
                console.log(`Loaded ${processed}/${total} markers in ${elapsed}ms`);
            },
            maxClusterRadius: 50,        // Smaller cluster radius
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            removeOutsideVisibleBounds: true  // Remove markers outside view
        });
    }
    return L.layerGroup();
}

// Optimized display function with performance improvements
function displayObservations() {
    console.log('Displaying observations...');
    
    // Clear existing markers efficiently
    markerGroup.clearLayers();
    
    const filteredObs = getCurrentFilteredObservations();
    console.log(`Displaying ${filteredObs.length} observations`);
    
    // Use clustering for better performance with many markers
    if (filteredObs.length > 100) {
        markerGroup = createMarkerCluster();
        map.addLayer(markerGroup);
    }
    
    // Batch marker creation for better performance
    const markerBatch = [];
    
    filteredObs.forEach((obs, index) => {
        // Determine marker quality based on data completeness
        let qualityGrade = 'casual';
        if (obs.species !== 'Unknown Species' && obs.location && obs.date) {
            qualityGrade = 'research';
        } else if (obs.species !== 'Unknown Species') {
            qualityGrade = 'needs_id';
        }
        
        // Create custom round marker
        const marker = createCustomMarker(
            obs.coordinates[0], 
            obs.coordinates[1], 
            obs.species, 
            obs.commonName,
            qualityGrade
        );
        
        // Optimized popup content
        const popupContent = createOptimizedPopup(obs);
        
        marker.bindPopup(popupContent, {
            maxWidth: 300,
            closeButton: true,
            autoPan: true,
            keepInView: true,
            className: 'custom-popup'
        });
        
        // Add hover effects for better UX
        marker.on('mouseover', function(e) {
            this.setStyle({
                radius: 8,
                weight: 3
            });
        });
        
        marker.on('mouseout', function(e) {
            this.setStyle({
                radius: 6,
                weight: 2
            });
        });
        
        markerBatch.push(marker);
        
        // Add markers in batches to prevent UI blocking
        if (markerBatch.length >= 50 || index === filteredObs.length - 1) {
            markerBatch.forEach(m => markerGroup.addLayer(m));
            markerBatch.length = 0; // Clear batch
            
            // Give browser time to breathe
            if (index < filteredObs.length - 1) {
                setTimeout(() => {}, 0);
            }
        }
    });
    
    // Fit map bounds efficiently
    if (filteredObs.length > 0) {
        // Use a timeout to ensure smooth animation
        setTimeout(() => {
            try {
                const bounds = markerGroup.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { 
                        padding: [20, 20],
                        maxZoom: 12  // Don't zoom in too much
                    });
                }
            } catch (error) {
                console.log('Could not fit bounds:', error);
            }
        }, 100);
    }
    
    updateStats();
}

// Optimized popup creation
function createOptimizedPopup(obs) {
    return `
        <div class="butterfly-popup">
            <div class="popup-species">${obs.species}</div>
            <div class="popup-common">${obs.commonName}</div>
            ${obs.imageUrl ? `
                <img src="${obs.imageUrl}" 
                     class="popup-image" 
                     alt="${obs.species}" 
                     loading="lazy"
                     onerror="this.style.display='none'">
            ` : ''}
            <div class="popup-details">
                <div class="popup-location">📍 ${obs.location}</div>
                ${obs.date ? `<div class="popup-date">📅 ${obs.date}</div>` : ''}
                ${obs.photographer ? `<div class="popup-photographer">📷 ${obs.photographer}</div>` : ''}
            </div>
        </div>
    `;
}

// Add these CSS improvements to your main HTML file:
const improvedCSS = `
<style>
/* Smooth map performance */
.leaflet-container {
    font-family: Arial, sans-serif;
}

/* Custom popup styling */
.butterfly-popup {
    text-align: center;
    min-width: 200px;
}

.popup-species {
    font-style: italic;
    font-weight: bold;
    color: #2c5530;
    margin-bottom: 4px;
}

.popup-common {
    font-weight: bold;
    color: #1976D2;
    margin-bottom: 8px;
}

.popup-image {
    width: 200px;
    height: 150px;
    object-fit: cover;
    border-radius: 8px;
    margin: 8px 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.popup-details {
    text-align: left;
    font-size: 12px;
    color: #666;
    line-height: 1.4;
}

.popup-location, .popup-date, .popup-photographer {
    margin: 2px 0;
}

/* Smooth marker transitions */
.leaflet-marker-icon {
    transition: all 0.2s ease;
}

/* Cluster styling improvements */
.marker-cluster {
    background-color: rgba(40, 167, 69, 0.6);
    border: 2px solid rgba(40, 167, 69, 0.8);
}

.marker-cluster div {
    background-color: rgba(40, 167, 69, 0.8);
    color: white;
    font-weight: bold;
}
</style>
`;

// Performance monitoring
function measurePerformance(operation, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`${operation} took ${(end - start).toFixed(2)}ms`);
    return result;
}

// Replace your existing filterObservations function with this optimized version:
function filterObservations() {
    measurePerformance('Filter and display', () => {
        displayObservations();
    });
}

// Add this to prevent memory leaks during frequent updates
function clearMapEfficiently() {
    if (markerGroup) {
        markerGroup.eachLayer(layer => {
            layer.off(); // Remove all event listeners
        });
        markerGroup.clearLayers();
    }
    updateStats();
}
