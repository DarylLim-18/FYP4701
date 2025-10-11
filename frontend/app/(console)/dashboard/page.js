// import Image from "next/image";
// import styles from './globals.css'
import MapWrapper from '../../components/Map/MapWrapper';


export default function Home() {
    return (
        <main>
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 text-white">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            {/* <p>Welcome to your application!</p> */}
            <p>Explore asthma prevalence over time with this interactive spatial analysis platform. </p>
            
        </div>
        <div className="p-3"></div>
        <div className="bg-gray-800 rounded-lg shadow-xl p-6"><MapWrapper /></div>

        <div className="p-3"></div>
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 text-white">
            <p>卐 This is a predictive analysis using Machine Learning.
                Do take note that the accuracy of the prediction is not 100% and should be used as a reference only.
                卐
            </p>
            <p></p>
            
        </div>
        {/* Insert any content below */}

        </main>
    );
  }