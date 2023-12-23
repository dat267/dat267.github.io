"use client";

import { auth } from "@/firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 6;

  const isFormValid = isEmailValid && isPasswordValid;

  const handleSignIn = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (!isFormValid) {
        setError("Please fix the form errors before submitting");
        return;
      }

      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('User signed in successfully:', result.user?.email);
      setSuccess("Sign in successful!");
      // Additional logic or redirection after successful sign-in
    } catch (error: any) {
      setError(error.message);
      console.error('Error signing in:', error.message);
    }
  };

  return (
    <form className="max-w-md mx-auto mt-8 bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
      {renderInput("Email", "email", email, setEmail, isEmailValid, "Please enter a valid email address.")}
      {renderInput("Password", "password", password, setPassword, isPasswordValid, "Password must be at least 6 characters long.")}

      <div className="flex items-center justify-between mt-6">
        <button
          className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${isFormValid ? '' : 'opacity-50 cursor-not-allowed'}`}
          type="button"
          onClick={handleSignIn}
          disabled={!isFormValid}
        >
          Sign In
        </button>
      </div>

      {renderMessage(error, "red-500")}
      {renderMessage(success, "green-500")}
    </form>
  );
}

// Helper function to render input fields
function renderInput(label: string, id: string, value: string, setValue: React.Dispatch<React.SetStateAction<string>>, isValid: boolean, errorMessage: string) {
  return (
    <>
      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={id}>
        {label}:
      </label>
      <input
        className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${!isValid && value !== '' && 'border-red-500'}`}
        id={id}
        type={id === 'email' ? 'email' : 'password'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={label}
        autoComplete={id === 'password' ? 'new-password' : 'on'} // Set autocomplete attribute
        required
      />
      {!isValid && value !== '' && (
        <div className="text-red-500 text-sm mt-1">
          {errorMessage}
        </div>
      )}
    </>
  );
}

// Helper function to render error or success messages
function renderMessage(message: string | null, colorClass: string) {
  return message && (
    <div className={`text-${colorClass} mt-4`}>
      {message}
    </div>
  );
}