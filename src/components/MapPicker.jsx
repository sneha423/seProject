import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search } from "lucide-react";

const nominatimSearch = async (query) => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    query
  )}&limit=5&addressdetails=1`;
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "ridecircle-client/1.0",
    },
  });
  return response.json();
};

const nominatimReverse = async (lat, lng) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "ridecircle-client/1.0",
    },
  });
  return response.json();
};

const MapClickHandler = ({ onClick }) => {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng);
    },
  });
  return null;
};

const MapPicker = ({ onLocationSelect, defaultLocation, label = "Select Location" }) => {
  const [center, setCenter] = useState(defaultLocation || { lat: 30.7333, lng: 76.7794 });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (defaultLocation) {
      setCenter(defaultLocation);
      setSelectedLocation(defaultLocation);
    }
  }, [defaultLocation]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Enter a location to search.");
      return;
    }
    setSearchLoading(true);
    setError("");
    try {
      const data = await nominatimSearch(query);
      if (!Array.isArray(data) || data.length === 0) {
        setError("No results found. Try a different address.");
        setResults([]);
      } else {
        setResults(data);
      }
    } catch (err) {
      setError("Search failed. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  const selectResult = (result) => {
    const location = {
      address: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };
    setSelectedLocation(location);
    setCenter({ lat: location.lat, lng: location.lng });
    setResults([]);
    onLocationSelect(location);
  };

  const handleMapClick = async (latlng) => {
    setError("");
    try {
      const data = await nominatimReverse(latlng.lat, latlng.lng);
      const address = data.display_name || `Lat ${latlng.lat.toFixed(5)}, Lon ${latlng.lng.toFixed(5)}`;
      const location = {
        address,
        lat: latlng.lat,
        lng: latlng.lng,
      };
      setSelectedLocation(location);
      setCenter({ lat: latlng.lat, lng: latlng.lng });
      onLocationSelect(location);
    } catch (err) {
      setError("Unable to resolve the selected location. Please try again.");
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        <MapPin size={16} className="inline mr-2" />
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a location"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          disabled={searchLoading}
        >
          {searchLoading ? "Searching..." : <><Search size={16} className="inline mr-2" />Search</>}
        </button>
      </div>

      {error && (
        <div className="w-full p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 space-y-2">
          {results.map((result) => (
            <button
              key={result.place_id}
              type="button"
              onClick={() => selectResult(result)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50"
            >
              <span className="text-sm text-gray-800">{result.display_name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-300">
        <MapContainer center={center} zoom={13} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onClick={handleMapClick} />
          {selectedLocation && (
            <CircleMarker
              center={[selectedLocation.lat, selectedLocation.lng]}
              radius={10}
              pathOptions={{ color: "#4338ca", fillColor: "#818cf8", fillOpacity: 1 }}
            />
          )}
        </MapContainer>
      </div>

      {selectedLocation && (
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-800">
            <MapPin size={14} className="inline mr-1" />
            Selected: {selectedLocation.address}
          </p>
        </div>
      )}
    </div>
  );
};

export default MapPicker;
