// ===================================================================
// MY PROFILE SCRIPT (for my_profile.html)
// ===================================================================

(function() {
    'use strict';

    const fullNameInput = $('#fullName');
    const emailAddressInput = $('#emailAddress');
    const phoneNumberInput = $('#phoneNumber');
    const dobInput = $('#dob');
    const profileForm = $('#profileForm');

    // 1. Page load aana odane user details ah fetch panni form la kaatrom
    function populateProfileForm() {
        const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
        
        // User login pannalana, login page ku anupidrom
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }

        // sessionStorage la irundhu data eduthu form la podrom
        fullNameInput.value = `${currentUser.first_name} ${currentUser.last_name}`;
        emailAddressInput.value = currentUser.email;
        
        // Additional details localStorage la irundha eduthukalam
        const userDetails = JSON.parse(localStorage.getItem(`userDetails_${currentUser.email}`)) || {};
        phoneNumberInput.value = userDetails.phone || '';
        dobInput.value = userDetails.dob || '';
    }

    // 2. Form submit aana, enna nadakanum
    async function handleProfileUpdate(event) {
        event.preventDefault();
        
        const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
        if (!currentUser) {
            showToast("You are not logged in!", true);
            return;
        }

        const nameParts = fullNameInput.value.trim().split(' ');
        const firstName = nameParts.shift() || '';
        const lastName = nameParts.join(' ') || '';

        // Update panra data-va oru object la ready panrom
        const updatedData = {
            userId: currentUser.id,
            firstName: firstName,
            lastName: lastName,
        };

        // Backend ku update request anuprom
        try {
            const response = await fetch('http://localhost:5000/api/user/update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            const result = await response.json();

            if (response.ok) {
                // Success aana, sessionStorage la irukara user data-vayum update panrom
                const updatedUser = { ...currentUser, first_name: firstName, last_name: lastName };
                sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
                
                // Phone and DOB ah localStorage la save panrom
                const userDetails = {
                    phone: phoneNumberInput.value,
                    dob: dobInput.value
                };
                localStorage.setItem(`userDetails_${currentUser.email}`, JSON.stringify(userDetails));

                showToast("Profile updated successfully!");
                
                // Navbar la per maaruradhuku, global function ah call panrom
                if (typeof window.updateLoginStatus === 'function') {
                    window.updateLoginStatus();
                }

            } else {
                showToast(result.message || "Failed to update profile.", true);
            }

        } catch (error) {
            console.error("Profile update error:", error);
            showToast("An error occurred. Please try again.", true);
        }
    }

    // Event listener-ah form-kooda attach panrom
    profileForm.addEventListener('submit', handleProfileUpdate);
    
    // Page ready aana odane indha function run aaganum
    document.addEventListener('DOMContentLoaded', populateProfileForm);

})();
