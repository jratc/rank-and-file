'use client';

/* ── FEATURE FLAG ──────────────────────────────────────────────
   To disable maps, comment out the <PlacesMap> usage
   in ranking-list.tsx / dashboard.tsx (search for "FEATURE: Places Map")
   ──────────────────────────────────────────────────────────── */

import { useState, useMemo, useEffect, useRef } from 'react';
import { MapPin, X, ExternalLink } from 'lucide-react';

declare global {
    interface Window {
        google: any;
    }
}

interface PlaceItem {
    name: string;
    subtitle: string;
    lat: number;
    lng: number;
    imageUrl?: string;
    externalUrl?: string;
}

interface PlacesMapProps {
    items: PlaceItem[];
    title?: string;
    onClose?: () => void;
    fullScreen?: boolean;
}

/**
 * Extract lat/lng from a list item's metadata.
 * Works with both Google Places (geometry.location) and Photon (coordinates).
 */
export function extractLocation(item: any): { lat: number; lng: number } | null {
    const meta = item?.metadata;
    if (!meta) return null;

    // Google Places Legacy API: rawMetadata.geometry.location
    const googleLoc = meta.rawMetadata?.geometry?.location;
    if (googleLoc?.lat && googleLoc?.lng) {
        return { lat: Number(googleLoc.lat), lng: Number(googleLoc.lng) };
    }

    // Photon: rawMetadata stored at meta level, coordinates in GeoJSON format [lng, lat]
    const photonCoords = meta.rawMetadata?.geometry?.coordinates;
    if (photonCoords && photonCoords.length >= 2) {
        return { lat: Number(photonCoords[1]), lng: Number(photonCoords[0]) };
    }

    // Fallback: check if lat/lng are directly in rawMetadata
    if (meta.rawMetadata?.lat && meta.rawMetadata?.lng) {
        return { lat: Number(meta.rawMetadata.lat), lng: Number(meta.rawMetadata.lng) };
    }

    // Fallback: check top-level metadata for lat/lng
    if (meta.lat && meta.lng) {
        return { lat: Number(meta.lat), lng: Number(meta.lng) };
    }

    return null;
}

/**
 * Convert list_items array to PlaceItem array by extracting locations.
 */
export function itemsToPlaces(listItems: any[]): PlaceItem[] {
    return listItems
        .map((item) => {
            const loc = extractLocation(item);
            if (!loc) return null;
            return {
                name: item.metadata?.name || 'Unknown',
                subtitle: item.metadata?.subtitle || '',
                lat: loc.lat,
                lng: loc.lng,
                imageUrl: item.metadata?.imageUrl,
                externalUrl: item.metadata?.externalUrl,
            };
        })
        .filter(Boolean) as PlaceItem[];
}

export function PlacesMap({ items, title, onClose, fullScreen = false }: PlacesMapProps) {
    const [selectedPlace, setSelectedPlace] = useState<PlaceItem | null>(null);

    // Calculate center and zoom from items
    const { center, zoom } = useMemo(() => {
        if (items.length === 0) return { center: { lat: 38.9, lng: -77.0 }, zoom: 12 };

        const lats = items.map(i => i.lat);
        const lngs = items.map(i => i.lng);
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

        const latSpan = Math.max(...lats) - Math.min(...lats);
        const lngSpan = Math.max(...lngs) - Math.min(...lngs);
        const maxSpan = Math.max(latSpan, lngSpan);

        let z = 13;
        if (maxSpan > 10) z = 5;
        else if (maxSpan > 5) z = 7;
        else if (maxSpan > 2) z = 9;
        else if (maxSpan > 0.5) z = 11;
        else if (maxSpan > 0.1) z = 13;
        else z = 14;

        return { center: { lat: centerLat, lng: centerLng }, zoom: z };
    }, [items]);

    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);

    // Initialize Map
    useEffect(() => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey || !mapRef.current) return;

        const initMap = () => {
            if (!window.google?.maps) return;
            if (googleMapRef.current) return;

            const map = new window.google.maps.Map(mapRef.current, {
                center: center,
                zoom: zoom,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                styles: [
                    { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
                ]
            });
            googleMapRef.current = map;
        };

        if (!window.google?.maps) {
            const existingScript = document.querySelector(`script[src^="https://maps.googleapis.com/maps/api/js"]`);
            if (existingScript) {
                existingScript.addEventListener('load', () => {
                    initMap();
                    updateMarkers();
                });
            } else {
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
                script.async = true;
                script.onload = () => {
                    initMap();
                    updateMarkers();
                };
                document.body.appendChild(script);
            }
        } else {
            initMap();
        }

        return () => {
            if (googleMapRef.current) {
                googleMapRef.current = null;
            }
        };
    }, []);

    // Update Markers when items change
    const updateMarkers = () => {
        const map = googleMapRef.current;
        if (!map || !window.google?.maps) return;

        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        const bounds = new window.google.maps.LatLngBounds();
        items.forEach((item, index) => {
            const position = { lat: item.lat, lng: item.lng };
            const marker = new window.google.maps.Marker({
                position,
                map,
                title: item.name,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 12,
                    fillColor: "#FACC15",
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: "#000000",
                },
                label: {
                    text: (index + 1).toString(),
                    color: "black",
                    fontWeight: "900",
                    fontSize: "12px",
                }
            });

            const infoWindow = new window.google.maps.InfoWindow({
                content: `<div style="padding:4px; font-weight:bold">${item.name}</div><div style="font-size:10px">${item.subtitle}</div>`
            });

            marker.addListener("click", () => {
                infoWindow.open({ anchor: marker, map });
                setSelectedPlace(item);
            });

            markersRef.current.push(marker);
            bounds.extend(position);
        });

        if (items.length > 1) {
            map.fitBounds(bounds);
        } else if (items.length === 1) {
            map.setCenter({ lat: items[0].lat, lng: items[0].lng });
            map.setZoom(15);
        }
    };

    useEffect(() => {
        updateMarkers();
    }, [items]);

    const googleMapsLink = useMemo(() => {
        if (items.length === 0) return '#';
        if (items.length === 1) {
            return `https://www.google.com/maps/search/?api=1&query=${items[0].lat},${items[0].lng}`;
        }
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title || '')}`;
    }, [items, title]);

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400 bg-slate-50 rounded-xl">
                <MapPin className="h-8 w-8 mb-2 opacity-50" />
                <p>No locations available</p>
            </div>
        );
    }

    const containerClass = fullScreen
        ? 'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200'
        : 'relative w-full';

    const mapClass = fullScreen
        ? 'max-w-5xl w-full max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl bg-white'
        : 'w-full rounded-xl overflow-hidden shadow-lg border border-slate-200 bg-white';

    return (
        <div className={containerClass}>
            <div className={mapClass}>
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-red-500" />
                        <h3 className="font-black text-sm uppercase tracking-widest text-slate-800">
                            {title || `${items.length} Places`}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={googleMapsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors"
                        >
                            <ExternalLink className="h-3 w-3" />
                            Open in Maps
                        </a>
                        {onClose && (
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Map Container */}
                <div className="relative w-full h-[400px] bg-slate-100">
                    {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                        <div className="flex flex-col items-center justify-center w-full h-full text-slate-400">
                            <MapPin className="h-8 w-8 mb-2 opacity-50" />
                            <p className="text-xs font-bold uppercase tracking-widest">Map Configuration Missing</p>
                            <p className="text-[10px] mt-1">Google Maps API Key not found</p>
                        </div>
                    ) : (
                        <div ref={mapRef} className="w-full h-full" />
                    )}
                </div>

                {/* Place List beneath map - Hidden as per request */}
                {/* 
                <div className="max-h-[200px] overflow-y-auto divide-y divide-slate-100">
                    {items.map((place, index) => (
                        <a
                            key={index}
                            href={place.externalUrl || `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors group"
                        >
                            <span className="font-mono font-black text-lg text-slate-200 w-8 text-right">
                                {index + 1}
                            </span>
                            {place.imageUrl && (
                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                                    <img src={place.imageUrl} alt={place.name} className="w-full h-full object-cover" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-slate-900 truncate uppercase">{place.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider truncate">{place.subtitle}</div>
                            </div>
                            <MapPin className="h-3.5 w-3.5 text-slate-300 group-hover:text-red-500 transition-colors shrink-0" />
                        </a>
                    ))}
                </div>
                */}
            </div>
        </div>
    );
}
