// ----------------------------------------------------------------
// AREA SELECTION FEATURE
// ----------------------------------------------------------------

let selectionLayer = null;
let drawnItems = null;
let isSelectionMode = false;

function initAreaSelection() {
    // Add Leaflet.draw drawn items layer
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Initialize draw control (rectangle only)
    const drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: {
            rectangle: {
                shapeOptions: {
                    color: '#2980b9',
                    fillColor: '#2980b9',
                    fillOpacity: 0.15,
                    weight: 2
                }
            },
            polygon: {
                shapeOptions: {
                    color: '#2980b9',
                    fillColor: '#2980b9',
                    fillOpacity: 0.15,
                    weight: 2
                }
            },
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });
    map.addControl(drawControl);

    // When a shape is drawn
    map.on(L.Draw.Event.CREATED, function(e) {
        // Clear previous selection
        drawnItems.clearLayers();
        selectionLayer = e.layer;
        drawnItems.addLayer(selectionLayer);

        // Filter gallery
        filterGalleryByBounds(selectionLayer);
    });

    // When selection is deleted
    map.on(L.Draw.Event.DELETED, function() {
        selectionLayer = null;
        clearAreaSelection();
    });

    // Add clear selection button
    addClearSelectionButton();
}

function filterGalleryByBounds(layer) {
    if (!infiniteGalleryUpdater) return;

    const bounds = layer.getBounds();

    // Filter allImages to those within bounds
    const filtered = infiniteGalleryUpdater.allImages.filter(img => {
        const coords = parseCoordinates(img.originalTitle || img.fullTitle);
        if (!coords) return false;
        return bounds.contains(L.latLng(coords[0], coords[1]));
    });

    // Update gallery with filtered results
    infiniteGalleryUpdater.filteredImages = filtered;
    infiniteGalleryUpdater.displayImages();

    // Show count badge
    showSelectionBadge(filtered.length);

    console.log(`Area selection: ${filtered.length} observations in bounds`);
}

function clearAreaSelection() {
    if (drawnItems) drawnItems.clearLayers();
    selectionLayer = null;

    // Reset gallery to current search filters
    if (infiniteGalleryUpdater) {
        infiniteGalleryUpdater.applyFilters();
    }

    hideSelectionBadge();
}

function showSelectionBadge(count) {
    let badge = document.getElementById('selectionBadge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'selectionBadge';
        badge.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(20, 20, 40, 0.75);
            border: 1px solid rgba(255,255,255,0.2);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            color: #fff;
            padding: 10px 20px;
            border-radius: 24px;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 9000;
            display: flex;
            align-items: center;
            gap: 12px;
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
                background: rgba(231,76,60,0.3);
                border: 1px solid rgba(231,76,60,0.5);
                border-radius: 8px;
                color: white;
                padding: 6px 12px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                backdrop-filter: blur(10px);
                display: none;
                white-space: nowrap;
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
