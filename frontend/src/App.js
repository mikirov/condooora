import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [logs, setLogs] = useState([]); // State to store logs
  const [page, setPage] = useState(1); // Current page
  const [totalPages, setTotalPages] = useState(1); // Total pages
  const [userId, setUserId] = useState(""); // Filter by userId
  const [cardId, setCardId] = useState(""); // Filter by cardId
  const limit = 10; // Number of logs per page
  const baseUrl = process.env.REACT_APP_BASE_URL || "http://172.20.10.6:3003";

  // Fetch logs from API
  const fetchLogs = async (page, filters = {}) => {
    try {
      const { userId, cardId } = filters;

      let url = `${baseUrl}/logs?page=${page}&limit=${limit}`;
      if (userId) {
        url = `${baseUrl}/logs/by-user?userId=${userId}&page=${page}&limit=${limit}`;
      } else if (cardId) {
        url = `${baseUrl}/logs/by-card?cardId=${cardId}&page=${page}&limit=${limit}`;
      }

      const response = await axios.get(url);
      const { data, total } = response.data;

      setLogs(data);
      setTotalPages(Math.ceil(total / limit));
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  // Fetch logs when component mounts or page/filters change
  useEffect(() => {
    fetchLogs(page, { userId, cardId });
  }, [page, userId, cardId]);

  // Handle page navigation
  const handleNextPage = () => {
    if (page < totalPages) setPage((prev) => prev + 1);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage((prev) => prev - 1);
  };

  // Handle filter by User ID
  const handleFindEventsForUser = (userId) => {
    setUserId(userId);
    setCardId("");
    setPage(1); // Reset to page 1
  };

  // Handle filter by Card ID
  const handleFindEventsForCard = (cardId) => {
    setCardId(cardId);
    setUserId("");
    setPage(1); // Reset to page 1
  };

  // Clear all filters
  const handleClearFilters = () => {
    setUserId("");
    setCardId("");
    setPage(1); // Reset to page 1
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white py-6 text-center">
          <h1 className="text-3xl font-bold">Logs Viewer</h1>
          <p className="text-sm font-medium mt-1">
            Filter logs by User ID or Card ID
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex justify-end px-6 py-4 bg-gray-50">
          <button
            onClick={handleClearFilters}
            className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition"
          >
            Clear Filters
          </button>
        </div>

        {/* Logs List Section */}
        <ul className="divide-y divide-gray-200">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex items-center px-6 py-4 hover:bg-gray-50 transition"
            >
              <div className="relative">
                <img
                  src={`https://i.pravatar.cc/150?u=${log.id}`}
                  alt={`Log ${log.id}`}
                  className="w-16 h-16 rounded-full shadow-lg"
                />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm text-gray-600">
                  Entry Type: {log.entryType.replace("_", " ")}
                </p>
                <p className="text-sm text-gray-500">
                  Timestamp: {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => handleFindEventsForUser(log.userId)}
                  className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
                >
                  Find events for User
                </button>
                <button
                  onClick={() => handleFindEventsForCard(log.cardId)}
                  className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition"
                >
                  Find events for Card
                </button>
              </div>
            </li>
          ))}
        </ul>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center px-6 py-4 bg-gray-50">
          <button
            onClick={handlePreviousPage}
            disabled={page === 1}
            className="text-purple-600 hover:text-purple-800 font-medium text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={page === totalPages}
            className="text-purple-600 hover:text-purple-800 font-medium text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;