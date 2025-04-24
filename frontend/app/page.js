// import Image from "next/image";
import styles from './globals.css'
import MapWrapper from './components/Map/MapWrapper';



export default function Home() {
    return (
        <main>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p>Welcome to your application!</p>
            <p></p>
            
        </div>
        <div className="p-3"></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6"><MapWrapper /></div>
        </main>
    );
  }