# Add project specific ProGuard rules here.

# Keep Firebase Auth
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Keep Gson data classes (domain models serialized to/from JSON)
-keep class com.example.budgetapp.domain.** { *; }

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
