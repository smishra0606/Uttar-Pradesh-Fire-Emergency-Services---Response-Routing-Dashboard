# Uttar Pradesh Fire & Emergency Services - Response Routing Dashboard

![Project Banner - UP Fire Dashboard](fire.jpg)

A high-performance, interactive dashboard for the Uttar Pradesh Fire & Emergency Services, designed to assist dispatchers in **planning optimal routes** for emergency vehicles. This tool provides real-time routing, simulates dynamic road conditions, and manages emergency priorities, all within a responsive, dark-mode interface.

The core of this project is a practical demonstration of **Dijkstra's shortest path algorithm**, allowing for custom, local graph-based routing as a resilient alternative to external APIs.

## 🚀 Key Features

* **Interactive Map Interface:** Built with Leaflet.js and Esri's dark-mode basemaps for clear, 24/7 operations.
* **Dynamic Point-to-Point Routing:** Intuitively click the map to set start (e.g., fire station) and end (incident) locations.
* **Dijkstra's Algorithm Implementation:**
    * **Build Local Graphs:** Operators can dynamically add "Intersections" (nodes) and "Roads" (edges) to create a simplified, custom road network.
    * **Shortest Path Calculation:** When a local graph is present, the app uses Dijkstra's algorithm (backed by a Min-Priority Queue) to find the mathematically shortest path within that network.
* **API Fallback:** If no local graph is built, the system gracefully falls back to the **OSRM (Open Source Routing Machine) API** for standard road-aware routing.
* **Priority-Adjusted ETA:** The ETA is automatically adjusted based on the emergency's priority (High, Medium, or Low), simulating faster response times for critical incidents.
* **Live Condition Management:**
    * **Road Block Mode:** Add persistent obstructions to the map that the routing algorithm must avoid.
    * **Traffic Simulation:** A "Simulate Traffic" button adds random delays and visual markers to an existing route, updating the ETA in real-time.
* **Responsive Design:** Fully functional on both desktop and mobile/tablet layouts, allowing for use in command centers or in the field.

## 💻 Technical Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Mapping Library:** [Leaflet.js](https://leafletjs.com/)
* **Map Tiles & Geocoding:** [Esri Leaflet](https://developers.arcgis.com/leaflet/)
* **Routing (API):** [OSRM (Open Source Routing Machine)](http://project-osrm.org/)
* **Routing (Local):S:** Custom implementation of **Dijkstra's Algorithm**

## 🔧 How to Use

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git)
    ```
2.  **Open `index.html`:**
    No complex setup is required. Simply open the `index.html` file in your web browser.

---

### 🗺️ Operational Workflow:

1.  **Set Points:** Click on the map to set a **Start Point** (green) and an **End Point** (red).
2.  **Set Conditions:**
    * Select an **Emergency Priority** (High, Medium, or Low).
    * (Optional) Toggle **"Enable Road Block Mode"** and click the map to add obstructions.
3.  **Calculate Route:**
    * Press **"Calculate Optimal Route"**.
    * The app will use the OSRM API to find the path.
4.  **Simulate:**
    * Once a route is visible, press **"Simulate Traffic Conditions"** to see how delays affect the ETA.

### 🧠 Using Dijkstra's Algorithm:

1.  **Build Graph:**
    * Click **"Add Intersection (Node)"** and add several nodes to the map.
    * Click **"Link Intersections (Edge)"** and click two nodes to link them with a road (an edge).
2.  **Set Points:** Place your Start and End markers *near* your graph nodes.
3.  **Calculate Route:**
    * Press **"Calculate Optimal Route"**.
    * The app will automatically detect your local graph, find the nearest nodes to your markers, and run Dijkstra's algorithm to find the shortest path between them. The route summary will show **"Algorithm: Dijkstra (Local Graph)"**.

## 📁 Project Structure

```
.
├── index.html     # The main HTML file containing the app structure.
├── style.css      # All custom styles, layout, and responsiveness.
└── script.js      # All application logic, including:
                   # - Leaflet map initialization
                   # - UI event listeners
                   # - OSRM API fetch logic
                   # - Graph data structures (nodes, edges)
                   # - MinPriorityQueue class
                   # - Dijkstra's algorithm implementation
```

## 🌟 Future Enhancements

* **Implement A\* Search:** Upgrade from Dijkstra's to A\* by adding a heuristic (using Haversine distance) for even more efficient local pathfinding.
* **Live Vehicle Tracking:** Add simulated fire truck icons that move along the calculated route in real-time.
* **Incident Triage Queue:** Create a list to manage multiple active incidents, sorted by priority.

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
