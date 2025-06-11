'use client';
import { useState } from 'react';
import DataUpload from '../components/DataUpload/DataUpload';

export default function DataPage() {
    const [refreshKey, setRefreshKey] = useState(0);
    const handleUploadSuccess = (file) => {
        console.log('File ready for processing:', file.name);
        // Add your file processing logic here
        setRefreshKey(prev => prev + 1); // Triggers DocumentList refresh
    };

    return (
        <main>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
                <h1 className="text-2xl font-bold">Data Management</h1>
                <p>All your data analytics and management tools</p>
                <p></p>
                
            </div>
            <div className="p-3"></div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">        
                <DataUpload onUploadSuccess={handleUploadSuccess}/>
            </div>
        </main>
    );
}
// export default function DataPage() {
//     return (
//       <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
//         <h1 className="text-2xl font-bold">Data Management</h1>
//         <p>All your data analytics and management tools</p>
//       </div>
//     );
// }