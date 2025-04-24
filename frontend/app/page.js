// import Image from "next/image";
import styles from './globals.css'
import MapWrapper from './components/Map/MapWrapper';



export default function Home() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p>Welcome to your application!</p>
            <MapWrapper />
        </div>
    );
  }