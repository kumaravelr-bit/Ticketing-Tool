import React, { useMemo, useState } from "react";
import { FiCrosshair, FiMapPin, FiNavigation } from "react-icons/fi";
import styles from "../../css/new_connections/NewConnectionForm.module.css";

const DEFAULT_MAP_CENTER = {
  lat: 13.0827,
  lng: 80.2707,
};

function parseLatLong(value) {
  if (!value) {
    return null;
  }

  const parts = String(value)
    .split(",")
    .map((item) => item.trim());

  if (parts.length !== 2) {
    return null;
  }

  const lat = Number(parts[0]);
  const lng = Number(parts[1]);

  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng };
}

function formatCoordinates(lat, lng) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function buildMapUrl(lat, lng) {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}

function LatLongMapField({ value, onChange, error, readOnly = false }) {
  const coordinates = useMemo(() => parseLatLong(value), [value]);
  const [locationState, setLocationState] = useState("manual");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const mapCoordinates = coordinates || DEFAULT_MAP_CENTER;

  const handleCurrentLocation = () => {
    if (readOnly) {
      return;
    }

    if (!navigator.geolocation) {
      setGeoError("Current location is not supported in this browser.");
      return;
    }

    setGeoLoading(true);
    setGeoError("");

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextValue = formatCoordinates(coords.latitude, coords.longitude);
        onChange(nextValue);
        setLocationState("current");
        setGeoLoading(false);
      },
      () => {
        setGeoError("Unable to fetch current location.");
        setGeoLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleManualChange = (event) => {
    onChange(event.target.value);
    setLocationState("manual");
    setGeoError("");
  };

  return (
    <div className={`${styles.field} ${styles.mapField}`}>
      <label className={styles.label}>LATITUDE, LONGITUDE *</label>

      <div className={styles.mapInputWrap}>
        <input
          className={`${styles.input} ${styles.mapInput} ${error ? styles.inputError : ""}`}
          value={value}
          placeholder="Enter Lat & Long"
          onChange={handleManualChange}
          readOnly={readOnly}
        />
        <button
          type="button"
          className={styles.mapToggle}
          title="Use current location"
          onClick={handleCurrentLocation}
          disabled={geoLoading || readOnly}
        >
          <FiCrosshair />
        </button>
      </div>

      <div className={styles.mapHelperRow}>
        <span className={styles.mapHelperText}>
          Enter latitude and longitude manually to preview the map automatically.
        </span>
        {coordinates ? (
          <span className={styles.mapBadge}>
            {locationState === "current" ? <FiNavigation /> : <FiMapPin />}
            {locationState === "current" ? "Current Location" : "Manual Location"}
          </span>
        ) : null}
      </div>

      {coordinates ? (
        <div className={styles.mapPreview}>
          <iframe
            title="Lead location map"
            src={buildMapUrl(mapCoordinates.lat, mapCoordinates.lng)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className={styles.mapMeta}>
            <span>{formatCoordinates(mapCoordinates.lat, mapCoordinates.lng)}</span>
            <span className={styles.mapMetaTag}>
              {locationState === "current" ? "Current location loaded" : "Map updated from manual entry"}
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.mapPlaceholder}>
          <FiMapPin />
          <span>Enter valid coordinates to display the map preview.</span>
        </div>
      )}

      {geoError ? <span className={styles.error}>{geoError}</span> : null}
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  );
}

export default LatLongMapField;
