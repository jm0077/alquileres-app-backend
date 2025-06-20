const admin = require('firebase-admin');

// Check if Firebase app is already initialized to avoid multiple initializations
if (!admin.apps.length) {
  try {
    let serviceAccount;
    
    if (process.env.NODE_ENV === 'production') {
      console.log('Inicializando Firebase en entorno de producción');
      
      // Opción 1: Usar FIREBASE_CREDENTIALS como JSON completo
      if (process.env.FIREBASE_CREDENTIALS) {
        try {
          serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
          console.log('Usando credenciales desde variable FIREBASE_CREDENTIALS');
        } catch (jsonError) {
          console.error('Error al parsear FIREBASE_CREDENTIALS como JSON:', jsonError);
          console.log('Intentando usar variables individuales...');
        }
      }
      
      // Opción 2: Usar variables individuales
      if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        serviceAccount = {
          type: process.env.FIREBASE_TYPE || 'service_account',
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),  // Reemplazar \n con saltos de línea reales
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
          token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
        };
        console.log('Usando credenciales desde variables de entorno individuales');
      }
      
      // Si no tenemos serviceAccount aún, intentar con GOOGLE_APPLICATION_CREDENTIALS
      if (!serviceAccount && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
          // Si es una ruta a un archivo
          serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
          console.log('Usando credenciales desde GOOGLE_APPLICATION_CREDENTIALS (archivo)');
        } catch (pathError) {
          try {
            // Si es un JSON directo
            serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
            console.log('Usando credenciales desde GOOGLE_APPLICATION_CREDENTIALS (JSON)');
          } catch (jsonError) {
            console.error('Error al usar GOOGLE_APPLICATION_CREDENTIALS:', jsonError);
          }
        }
      }
      
      // Si aún no tenemos credenciales, lanzar error
      if (!serviceAccount) {
        throw new Error('No se encontraron credenciales de Firebase válidas en las variables de entorno.')
      }
    } else {
      // Para entorno de desarrollo, usar archivo local
      console.log('Inicializando Firebase en entorno de desarrollo');
      
      try {
        // Para alquileres-app, usaremos el mismo proyecto de Firebase que finanzas-app
        serviceAccount = require('../service-account-key.json');
        console.log('Usando credenciales desde archivo service-account-key.json');
      } catch (e) {
        throw new Error('No se encontró el archivo service-account-key.json. Por favor, cópialo desde finanzas-app-backend.');
      }
    }
    
    // Inicializar Firebase con las credenciales encontradas
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${serviceAccount.project_id}.firebaseio.com`
    });
    
    console.log('Firebase inicializado correctamente para Alquileres App');
  } catch (error) {
    console.error('Error al inicializar Firebase:', error);
    throw error; // Re-lanzar el error para detener la aplicación si Firebase no puede inicializarse
  }
} else {
  console.log('Firebase ya estaba inicializado');
}

module.exports = admin;
